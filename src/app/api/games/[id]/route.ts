import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  computeFanScores,
  InvalidGameError,
  MIN_FAN,
  MAX_FAN,
} from "@/lib/scoring";
import { recalculateElo } from "@/lib/eloRecalc";

// PATCH /api/games/:id — fix a mis-recorded game after the fact (wrong
// winner, wrong fan count, wrong discarder, or a manually-entered/legacy
// row whose raw scores were mistyped). Never changes which 4 players were
// in the game — only the outcome — so the frontend only offers this for
// correcting mistakes, not for swapping a player out.
//
// Three mutually exclusive edit shapes, mirroring the three ways a game
// can be recorded (see POST /api/games and prisma/seed.ts's classifier):
//   - mode "draw": all participants score 0.
//   - mode "fan":  same discard/self-draw flow as recording a new game.
//   - mode "raw":  direct score entry, for "manual"/legacy rows that don't
//                  fit the fan model — caller supplies every participant's
//                  new score directly, and it must still sum to zero.
const EditGameSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("draw") }),
  z.object({
    mode: z.literal("fan"),
    winner: z.string(),
    fan: z.number().int().min(MIN_FAN).max(MAX_FAN),
    isSelfDraw: z.boolean().default(false),
    loser: z.string().optional(),
  }),
  z.object({
    mode: z.literal("raw"),
    scores: z.record(z.string(), z.number()),
  }),
]);

// A full recalc rereads every game in the table, so give the transaction
// more headroom than Prisma's 5s default — this matches the admin-only
// "Recalculate ELO" action sketched as a TODO in lib/elo.ts, which this
// route is the first real caller of.
const RECALC_TRANSACTION_OPTS = { timeout: 30_000 };

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = EditGameSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const existing = await prisma.game.findUnique({
    where: { id },
    include: { scores: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }
  const participantIds = existing.scores.map((s) => s.playerId);

  let scores: Record<string, number>;
  let winType: "discard" | "self_draw" | "draw" | "manual";
  let winnerId: string | null = null;
  let loserId: string | null = null;
  let fan: number | null = null;

  if (input.mode === "draw") {
    scores = Object.fromEntries(participantIds.map((pid) => [pid, 0]));
    winType = "draw";
  } else if (input.mode === "fan") {
    if (participantIds.length !== 4) {
      return NextResponse.json(
        { error: "Only 4-player games can use the fan-based flow." },
        { status: 400 },
      );
    }
    if (!input.isSelfDraw && !input.loser) {
      return NextResponse.json(
        { error: "Discarder (loser) is required unless self-draw." },
        { status: 400 },
      );
    }
    if (
      !participantIds.includes(input.winner) ||
      (input.loser && !participantIds.includes(input.loser))
    ) {
      return NextResponse.json(
        {
          error: "Winner/loser must be one of this game's original 4 players.",
        },
        { status: 400 },
      );
    }
    try {
      scores = computeFanScores({
        players: participantIds as [string, string, string, string],
        winner: input.winner,
        fan: input.fan,
        isSelfDraw: input.isSelfDraw,
        loser: input.loser,
      });
    } catch (err) {
      if (err instanceof InvalidGameError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
    winType = input.isSelfDraw ? "self_draw" : "discard";
    winnerId = input.winner;
    loserId = input.isSelfDraw ? null : (input.loser ?? null);
    fan = input.fan;
  } else {
    const providedIds = Object.keys(input.scores).sort();
    const sortedParticipantIds = [...participantIds].sort();
    if (
      providedIds.length !== sortedParticipantIds.length ||
      providedIds.some((pid, i) => pid !== sortedParticipantIds[i])
    ) {
      return NextResponse.json(
        {
          error: "Raw scores must cover exactly this game's original players.",
        },
        { status: 400 },
      );
    }
    const total = Object.values(input.scores).reduce((a, b) => a + b, 0);
    if (total !== 0) {
      return NextResponse.json(
        { error: `Scores must sum to zero (got ${total}).` },
        { status: 400 },
      );
    }
    scores = input.scores;
    winType = "manual";
  }

  const updated = await prisma.$transaction(async (tx) => {
    const game = await tx.game.update({
      where: { id },
      data: { winType, fan, winnerId, loserId },
    });
    await Promise.all(
      participantIds.map((pid) =>
        tx.gameScore.update({
          where: { gameId_playerId: { gameId: id, playerId: pid } },
          data: { score: scores[pid]! },
        }),
      ),
    );
    // ELO is incremental in playedAt order, so correcting this game's
    // outcome invalidates every later ELO number too — cheapest correct
    // fix is a full rebuild rather than trying to patch downstream rows.
    await recalculateElo(tx);
    return game;
  }, RECALC_TRANSACTION_OPTS);

  return NextResponse.json({ game: updated, scores });
}

// DELETE /api/games/:id — permanently remove a mis-recorded game (e.g.
// duplicate submission, or a table's result logged against the wrong
// session). Cascades to game_scores; elo_history/elo_state are wiped and
// rebuilt from the remaining games for the same reason PATCH above does.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.game.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // elo_history.game_id is ON DELETE RESTRICT, so it (and elo_state,
    // which is cumulative and can't be partially patched either) has to
    // be cleared before the game row itself can go.
    await tx.eloHistory.deleteMany({});
    await tx.eloState.deleteMany({});
    await tx.game.delete({ where: { id } }); // cascades to game_scores
    await recalculateElo(tx);
  }, RECALC_TRANSACTION_OPTS);

  return NextResponse.json({ ok: true });
}
