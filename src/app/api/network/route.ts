import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { NetworkDataDTO } from '@/lib/types';

// GET /api/network — raw per-game participant/score rows, ported from
// getRawGameData() in code.gs. Co-play edges are computed client-side
// in NetworkGraph.tsx, same as the original network.html.
//
// TODO(scale): if the club grows past ~100 players, precompute edges
// server-side into a `player_pairs` materialized view instead of
// shipping every raw game row to the browser (see implementation plan
// Section 3.7).
export async function GET() {
  const players = await prisma.player.findMany({
    where: { archived: false },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const games = await prisma.game.findMany({
    orderBy: { playedAt: 'asc' },
    include: { scores: true },
  });

  const rows = games.map((game) => ({
    playedAt: game.playedAt.toISOString(),
    scoresByPlayer: Object.fromEntries(
      players.map((p) => {
        const gs = game.scores.find((s) => s.playerId === p.id);
        return [p.name, gs ? Number(gs.score) : null];
      })
    ),
  }));

  const result: NetworkDataDTO = { players: players.map((p) => p.name), rows };
  return NextResponse.json(result);
}
