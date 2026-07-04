import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { EloHistoryDTO } from '@/lib/types';

// GET /api/elo/history — one row per game with each player's rating
// after that game (null if they didn't play), ported from
// getEloHistoryData() in code.gs. Feeds the ELO Progression chart.
export async function GET() {
  const players = await prisma.player.findMany({
    where: { archived: false },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const history = await prisma.eloHistory.findMany({
    orderBy: { playedAt: 'asc' },
  });

  const byGame = new Map<string, typeof history>();
  history.forEach((row) => {
    const key = row.gameId;
    if (!byGame.has(key)) byGame.set(key, []);
    byGame.get(key)!.push(row);
  });

  const data = Array.from(byGame.values()).map((rows) => ({
    time: rows[0]!.playedAt.toISOString(),
    ratings: players.map((p) => {
      const row = rows.find((r) => r.playerId === p.id);
      return row ? Math.round(Number(row.ratingAfter)) : null;
    }),
  }));

  const result: EloHistoryDTO = { players: players.map((p) => p.name), data };
  return NextResponse.json(result);
}
