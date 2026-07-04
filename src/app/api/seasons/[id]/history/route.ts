import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/seasons/:id/history — final standings for one season,
// read from the permanent season_history table (never truncated).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const rows = await prisma.seasonHistory.findMany({
    where: { seasonId: params.id },
    orderBy: { finalRank: 'asc' },
    include: { player: { select: { name: true, icon: true } } },
  });
  return NextResponse.json(rows);
}
