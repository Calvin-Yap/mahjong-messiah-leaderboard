/**
 * LEADERBOARD — /leaderboard
 * Ports: the "Leaderboard" sheet (17 formula-driven columns) into a
 * server component that reads the /api/leaderboard aggregation.
 *
 * TODO(page):
 *   - [ ] Swap the direct prisma-in-page-component pattern below for a
 *         fetch('/api/leaderboard') call once that route is deployed
 *         behind a real DB — kept as a direct DB read here since this is
 *         a Server Component and can talk to Prisma without an extra hop.
 *   - [ ] Add column sort toggles (Total Score / W-L / ELO) — the three
 *         separate rank columns already exist server-side, just need UI.
 *   - [ ] Add a search/filter input above the table for large rosters.
 *   - [ ] Mobile: collapse to a card-per-player layout below `sm`, this
 *         is one of the widest tables in the app (17 cols in the original).
 */

import { Card } from '@/components/ui/Card';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { EndSeasonButton } from '@/components/leaderboard/EndSeasonButton';
import { prisma } from '@/lib/prisma';
import { getTitleForRank } from '@/lib/titles';

async function getActiveSeason() {
  return prisma.season.findFirst({ where: { isActive: true } });
}

async function getLeaderboard(activeSeasonId: string | null) {
  const players = await prisma.player.findMany({
    where: { archived: false },
    include: {
      // Scope to the active season so "clear the leaderboard each season"
      // works by filtering, independent of whether old seasons' rows have
      // actually been purged yet (see prisma/sql/end_season.sql).
      gameScores: activeSeasonId
        ? { where: { game: { seasonId: activeSeasonId } } }
        : true,
      eloState: true,
    },
  });

  const rows = players.map((p) => {
    const scores = p.gameScores.map((gs) => Number(gs.score));
    return {
      id: p.id,
      name: p.name,
      icon: p.icon,
      totalScore: scores.reduce((a, b) => a + b, 0),
      gamesPlayed: scores.length,
      eloRating: p.eloState ? Math.round(Number(p.eloState.rating)) : 1500,
    };
  });

  rows.sort((a, b) => b.totalScore - a.totalScore);
  return rows.map((r, i) => ({ ...r, rank: i + 1, title: getTitleForRank(i + 1, rows.length) }));
}

export default async function LeaderboardPage() {
  // TODO: these will throw until DATABASE_URL is configured — expected for boilerplate.
  const activeSeason = await getActiveSeason().catch(() => null);
  const rows = await getLeaderboard(activeSeason?.id ?? null).catch(() => []);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-ink-900">🏆 Leaderboard</h1>
          {activeSeason && (
            <p className="text-xs text-ink-400">
              {activeSeason.name} · started {activeSeason.startedAt.toDateString()}
            </p>
          )}
        </div>
        {activeSeason && (
          <EndSeasonButton
            activeSeasonId={activeSeason.id}
            activeSeasonName={activeSeason.name}
            nextSeasonNumber={activeSeason.seasonNumber + 1}
          />
        )}
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-ink-400">
            <th className="py-2">#</th>
            <th>Player</th>
            <th>Title</th>
            <th className="text-right">Total Score</th>
            <th className="text-right">Games</th>
            <th className="text-right">ELO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-ink-100">
              <td className="py-2 font-bold text-ink-400">{r.rank}</td>
              <td>
                <div className="flex items-center gap-2">
                  <PlayerAvatar icon={r.icon} name={r.name} size={28} />
                  <span className="font-semibold">{r.name}</span>
                </div>
              </td>
              <td className="text-ink-500">{r.title}</td>
              <td className="text-right font-bold">{r.totalScore}</td>
              <td className="text-right text-ink-500">{r.gamesPlayed}</td>
              <td className="text-right font-bold text-brand-600">{r.eloRating}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-ink-400">
                No players yet — connect the database or run the import script.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
