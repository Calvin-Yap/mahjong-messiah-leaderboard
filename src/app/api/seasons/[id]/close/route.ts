import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const CloseSeasonSchema = z.object({
  nextSeasonName: z.string().trim().min(1),
  resetElo: z.boolean().default(true), // see the ELO-reset decision note in prisma/sql/end_season.sql
});

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
  { params }: { params: { id: string } }
) {
  const parsed = CloseSeasonSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { nextSeasonName, resetElo } = parsed.data;

  const active = await prisma.season.findUnique({ where: { id: params.id } });
  if (!active?.isActive) {
    return NextResponse.json({ error: 'That season is not currently active.' }, { status: 409 });
  }

  // TODO(backup) goes here — see comment above.

  const rows = await prisma.$queryRaw<{ close_season: string }[]>`
    SELECT close_season(${nextSeasonName}, ${resetElo}) AS close_season
  `;
  const nextSeasonId = rows[0]?.close_season;

  const nextSeason = await prisma.season.findUnique({ where: { id: nextSeasonId } });
  return NextResponse.json(nextSeason, { status: 201 });
}
