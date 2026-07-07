import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CloseSeasonSchema = z.object({
  nextSeasonName: z.string().trim().min(1),
  resetElo: z.boolean().default(true), // see the ELO-reset decision note in prisma/sql/end_season.sql
});

// Postgres errors raised inside close_season() (e.g. `RAISE EXCEPTION 'No
// active season to close.'`) arrive wrapped in Prisma's raw-query error
// text rather than as a clean message — pull the actual DB message back
// out so the person clicking the button sees something useful instead of
// a generic failure (or, if left uncaught entirely, a blank 500 body that
// the frontend can't even JSON.parse).
function friendlyCloseSeasonError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const raw = (err.meta?.message as string | undefined) ?? err.message;
    const match = raw.match(/ERROR:\s*(.+)/);
    if (match) return match[1]!.split("\n")[0]!.trim();
    // Function not found (migration not applied yet) surfaces here as a
    // P2010 with a "function close_season(...) does not exist" message.
    if (raw.includes("does not exist")) {
      return (
        "The close_season() database function is missing. Run the " +
        "20260706120000_add_close_season_function migration against this database."
      );
    }
    return raw;
  }
  return err instanceof Error ? err.message : "Failed to end season.";
}

// POST /api/seasons/:id/close — the "End Season" button on /leaderboard.
//
// TODO(backup): before calling close_season(), export the season's raw
// games/game_scores/elo_history rows (e.g. a JSON dump uploaded to
// Supabase Storage) so the snapshot below is reversible if the rank
// calculation ever needs correcting. Sketched as a TODO rather than
// wired up, since it depends on which Storage bucket you provision.
//
// This route intentionally does NOT call purge_season_data() — that's
// a separate, manual, rarely-run operation (see prisma/sql/end_season.sql)
// since the storage math shows there's no urgency to delete anything.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = CloseSeasonSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }
  const { nextSeasonName, resetElo } = parsed.data;

  const active = await prisma.season.findUnique({ where: { id } });
  if (!active?.isActive) {
    return NextResponse.json(
      { error: "That season is not currently active." },
      { status: 409 },
    );
  }

  // TODO(backup) goes here — see comment above.

  try {
    const rows = await prisma.$queryRaw<{ close_season: string }[]>`
      SELECT close_season(${nextSeasonName}, ${resetElo}) AS close_season
    `;
    const nextSeasonId = rows[0]?.close_season;
    if (!nextSeasonId) {
      return NextResponse.json(
        { error: "close_season() ran but did not return a new season id." },
        { status: 500 },
      );
    }

    const nextSeason = await prisma.season.findUnique({
      where: { id: nextSeasonId },
    });
    return NextResponse.json(nextSeason, { status: 201 });
  } catch (err) {
    console.error("close_season() failed:", err);
    return NextResponse.json(
      { error: friendlyCloseSeasonError(err) },
      { status: 500 },
    );
  }
}
