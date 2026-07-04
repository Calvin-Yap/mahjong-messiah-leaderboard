/**
 * HALL OF FAME — /hall-of-fame
 * New page: browse every closed season's final standings, permanently
 * preserved in `season_history` regardless of whether the raw per-game
 * data for that season has since been purged.
 *
 * TODO(page):
 *   - [ ] Client component: fetch('/api/seasons') for the season list,
 *         then fetch('/api/seasons/:id/history') for the selected one —
 *         swapped for a direct Prisma read below since this can be a
 *         Server Component, but split into two client fetches if you
 *         want tab-switching without a full page reload.
 *   - [ ] Highlight the top 3 (🥇🥈🥉) and bottom 1 (💀 or similar) more
 *         visually — currently just plain rows.
 *   - [ ] Add a "Season MVP" callout card per season (rank 1 player,
 *         bigger avatar, headline stat).
 *   - [ ] Consider a cross-season "all-time" view: most Season wins,
 *         highest peak ELO ever, etc. — aggregate over season_history.
 */

import { Card } from '@/components/ui/Card';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { prisma } from '@/lib/prisma';

async function getClosedSeasons() {
  const seasons = await prisma.season.findMany({
    where: { isActive: false },
    orderBy: { seasonNumber: 'desc' },
    include: {
      history: {
        orderBy: { finalRank: 'asc' },
        include: { player: { select: { name: true, icon: true } } },
      },
    },
  });
  return seasons;
}

export default async function HallOfFamePage() {
  // TODO: this will throw until DATABASE_URL is configured — expected for boilerplate.
  const seasons = await getClosedSeasons().catch(() => []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-extrabold text-ink-900">🏛️ Hall of Fame</h1>

      {seasons.length === 0 && (
        <Card>
          <p className="text-center text-ink-400">
            No seasons have ended yet — close one from the Leaderboard page.
          </p>
        </Card>
      )}

      {seasons.map((season) => (
        <Card key={season.id}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-extrabold text-ink-900">{season.name}</h2>
            <span className="text-xs text-ink-400">
              {season.startedAt.toDateString()} – {season.endedAt?.toDateString()}
            </span>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-400">
                <th className="py-1">#</th>
                <th>Player</th>
                <th>Title</th>
                <th className="text-right">Score</th>
                <th className="text-right">ELO</th>
                <th className="text-right">W-L</th>
              </tr>
            </thead>
            <tbody>
              {season.history.map((row) => (
                <tr key={row.playerId} className="border-t border-ink-100">
                  <td className="py-1.5 font-bold text-ink-400">
                    {row.finalRank === 1 ? '🥇' : row.finalRank === 2 ? '🥈' : row.finalRank === 3 ? '🥉' : row.finalRank}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <PlayerAvatar icon={row.player.icon} name={row.player.name} size={24} />
                      <span className="font-semibold">{row.player.name}</span>
                    </div>
                  </td>
                  <td className="text-ink-500">{row.title}</td>
                  <td className="text-right font-bold">{Number(row.totalScore)}</td>
                  <td className="text-right text-brand-600">{Math.round(Number(row.finalElo))}</td>
                  <td className="text-right text-ink-500">
                    {row.gamesWon}-{row.gamesLost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
