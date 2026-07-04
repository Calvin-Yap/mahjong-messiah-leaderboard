import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { DashboardScoresDTO } from '@/lib/types';

// GET /api/dashboard/scores — cumulative score per player per game,
// ported from getGameData() in code.gs.
//
// TODO(perf): replace the JS running-total loop below with a SQL window
// function once this needs to scale past a season or two of games:
//   SUM(score) OVER (PARTITION BY player_id ORDER BY played_at)
export async function GET() {
  const players = await prisma.player.findMany({
    where: { archived: false },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const playerIds = players.map((p) => p.id);

  const games = await prisma.game.findMany({
    orderBy: { playedAt: 'asc' },
    include: { scores: true },
  });

  const cumulative = new Array(playerIds.length).fill(0);
  const data = games.map((game) => {
    playerIds.forEach((id, i) => {
      const gs = game.scores.find((s) => s.playerId === id);
      if (gs) cumulative[i] += Number(gs.score);
    });

    const sorted = [...cumulative].sort((a, b) => b - a);
    const ranks = cumulative.map((v) => sorted.indexOf(v) + 1);

    return {
      time: game.playedAt.toISOString(),
      cumulative: [...cumulative],
      ranks,
    };
  });

  const result: DashboardScoresDTO = { players: players.map((p) => p.name), data };
  return NextResponse.json(result);
}
