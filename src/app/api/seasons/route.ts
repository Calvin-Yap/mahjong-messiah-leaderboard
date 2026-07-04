import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/seasons — list all seasons (active + closed), newest first.
// Powers both the leaderboard's "Season X — active" badge and the
// Hall of Fame page's season list.
export async function GET() {
  const seasons = await prisma.season.findMany({
    orderBy: { seasonNumber: 'desc' },
  });
  return NextResponse.json(seasons);
}

// POST /api/seasons — bootstrap the very first season. Not used again
// after that; subsequent seasons are created by close_season() as part
// of ending the previous one (see /api/seasons/[id]/close).
export async function POST(req: NextRequest) {
  const { name } = await req.json();
  const existingActive = await prisma.season.findFirst({ where: { isActive: true } });
  if (existingActive) {
    return NextResponse.json({ error: 'A season is already active.' }, { status: 409 });
  }
  const season = await prisma.season.create({
    data: { seasonNumber: 1, name: name ?? 'Season 1', isActive: true },
  });
  return NextResponse.json(season, { status: 201 });
}
