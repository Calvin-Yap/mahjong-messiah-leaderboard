import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { computeFanScores, InvalidGameError } from '@/lib/scoring';
import {
  computeGameDeltas,
  applyDeltas,
  newPlayerState,
  type EloPlayerState,
} from '@/lib/elo';

const SubmitGameSchema = z.object({
  players: z.array(z.string()).length(4),
  winner: z.string(),
  fan: z.number().int().min(3).max(13),
  isSelfDraw: z.boolean(),
  loser: z.string().optional(),
  sessionId: z.string().optional(), // present when submitted from a live session table
  tableNumber: z.number().int().optional(),
});

// POST /api/games — Add New Game (fan-based scoring flow ported from
// buildFanGameSidebar()/submitGame() in code.gs)
export async function POST(req: NextRequest) {
  const parsed = SubmitGameSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const input = parsed.data;

  let scores: Record<string, number>;
  try {
    scores = computeFanScores(input);
  } catch (err) {
    if (err instanceof InvalidGameError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // TODO(transaction): wrap everything below in `prisma.$transaction(...)`
  // so the game insert + ELO update are atomic — sketched sequentially
  // here for readability.

  // 1. Insert the game + per-player scores, tagged with the active season
  //    so it's automatically scoped correctly in leaderboard/dashboard/etc.
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  const game = await prisma.game.create({
    data: {
      winType: input.isSelfDraw ? 'self_draw' : 'discard',
      fan: input.fan,
      winnerId: input.winner,
      loserId: input.isSelfDraw ? null : input.loser,
      sessionId: input.sessionId,
      seasonId: activeSeason?.id,
      tableNumber: input.tableNumber,
      scores: {
        create: Object.entries(scores).map(([playerId, score]) => ({ playerId, score })),
      },
    },
  });

  // 2. Incremental ELO update for just these 4 players (mirrors
  //    applyIncrementalElo_ in elo.gs — fast path, no full recalc).
  const existingStates = await prisma.eloState.findMany({
    where: { playerId: { in: input.players } },
  });
  const stateByName: Record<string, EloPlayerState> = {};
  input.players.forEach((id) => {
    const row = existingStates.find((s) => s.playerId === id);
    stateByName[id] = row
      ? {
          rating: Number(row.rating),
          gamesPlayed: row.gamesPlayed,
          peak: Number(row.peakRating),
          last5: row.last5Deltas.map(Number),
        }
      : newPlayerState();
  });

  const participants = input.players.map((id) => ({ name: id, score: scores[id]! }));
  const deltas = computeGameDeltas(participants, stateByName);
  applyDeltas(participants, stateByName, deltas);

  await Promise.all(
    input.players.map((id) => {
      const s = stateByName[id]!;
      return prisma.eloState.upsert({
        where: { playerId: id },
        create: {
          playerId: id,
          rating: s.rating,
          gamesPlayed: s.gamesPlayed,
          peakRating: s.peak,
          last5Deltas: s.last5,
        },
        update: {
          rating: s.rating,
          gamesPlayed: s.gamesPlayed,
          peakRating: s.peak,
          last5Deltas: s.last5,
        },
      });
    })
  );

  await prisma.eloHistory.createMany({
    data: input.players.map((id) => ({
      gameId: game.id,
      playerId: id,
      ratingAfter: stateByName[id]!.rating,
      delta: deltas[id]!,
      playedAt: game.playedAt,
    })),
  });

  // TODO(realtime): if this game came from a live session (input.sessionId
  // set), broadcast the result over Supabase Realtime so other devices
  // viewing the same session update immediately (see /session TODOs).

  return NextResponse.json({ game, scores }, { status: 201 });
}
