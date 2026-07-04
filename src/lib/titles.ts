/**
 * Title tiers by leaderboard rank — ported from the nested-IF title
 * formula written into every new Leaderboard row in submitNewPlayer().
 *
 * `rank` is 1-based position by total score; `total` is the number of
 * ranked players. Mirrors the original thresholds exactly.
 */
export function getTitleForRank(rank: number | null, total: number): string {
  if (rank == null) return 'Monk';
  if (rank === 1) return 'Messiah';
  if (rank >= 2 && rank <= 3) return 'Master';
  if (rank >= 4 && rank <= 6) return 'Musketeer';
  if (rank >= 7 && rank <= 10) return 'Marshal';
  if (rank === total) return 'Moron';
  if (rank >= total - 2 && rank <= total - 1) return 'Mongrel';
  if (rank >= total - 5 && rank <= total - 3) return 'Minion';
  if (rank >= total - 9 && rank <= total - 6) return 'Mortal';
  return 'Monk';
}
