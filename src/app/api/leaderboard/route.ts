import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTitleForRank } from '@/lib/titles';
import type { LeaderboardRowDTO } from '@/lib/types';

// GET /api/leaderboard
//
// TODO(perf): once this is stable, port the aggregation into the `leaderboard`
// SQL view from Section 2 of the implementation plan (or a materialized view
// refreshed after each game write) instead of aggregating in JS on every
// request — fine for a club-sized dataset today, worth revisiting at scale.
export async function GET() {
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });

  const players = await prisma.player.findMany({
    where: { archived: false },
    include: {
      gameScores: activeSeason
        ? { where: { game: { seasonId: activeSeason.id } } }
        : true,
      eloState: true,
    },
  });

  const rows = players.map((p) => {
    const scores = p.gameScores.map((gs) => Number(gs.score));
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const gamesWon = scores.filter((s) => s > 0).length;
    const gamesLost = scores.filter((s) => s < 0).length;

    return {
      id: p.id,
      name: p.name,
      icon: p.icon,
      totalScore,
      gamesPlayed: scores.length, // TODO: filter to post-cutoff games per the plan
      gamesWon,
      gamesLost,
      winLossRatio: gamesLost === 0 ? (gamesWon >= 1 ? 1 : 0) : gamesWon / gamesLost,
      bestWin: scores.length ? Math.max(...scores) : 0,
      worstLoss: scores.length ? Math.min(...scores) : 0,
      eloRating: p.eloState ? Number(p.eloState.rating) : 1500,
      eloPeak: p.eloState ? Number(p.eloState.peakRating) : 1500,
      eloLast5: p.eloState ? p.eloState.last5Deltas.reduce((a, b) => a + Number(b), 0) : 0,
    };
  });

  const byScore = [...rows].sort((a, b) => b.totalScore - a.totalScore);
  const byWinLoss = [...rows].sort((a, b) => b.winLossRatio - a.winLossRatio);
  const byElo = [...rows].sort((a, b) => b.eloRating - a.eloRating);

  const result: LeaderboardRowDTO[] = rows.map((r) => {
    const totalScoreRank = byScore.findIndex((x) => x.id === r.id) + 1;
    const winLossRank = byWinLoss.findIndex((x) => x.id === r.id) + 1;
    const eloRank = byElo.findIndex((x) => x.id === r.id) + 1;
    return {
      ...r,
      totalScoreRank,
      winLossRank,
      eloRank,
      title: getTitleForRank(totalScoreRank, rows.length),
    };
  });

  result.sort((a, b) => a.totalScoreRank - b.totalScoreRank);

  return NextResponse.json(result);
}
