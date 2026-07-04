'use client';

/**
 * PLAYER NETWORK — /network
 * Ports: network.html (vis-network graph, ego-graph mode, date/threshold filtering)
 *
 * TODO(page):
 *   - [ ] On mount, fetch('/api/network') instead of MOCK_DATA below.
 *   - [ ] Add a player <select> for ego-graph mode (single player → their
 *         direct connections only) vs. a multi-select "compare mode".
 *   - [ ] Add the min-games-together slider (mirrors the original's
 *         "minimum game threshold" control).
 *   - [ ] Add the date-range filter (mirrors "Default Timeframe: shows
 *         games from April 25, 2026 onward by default").
 *   - [ ] Wire NetworkGraph's vis-network TODO to render real nodes/edges
 *         on the client (dynamic import to avoid SSR issues).
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { NetworkGraph } from '@/components/network/NetworkGraph';
import type { NetworkDataDTO } from '@/lib/types';

// TODO(api): replace with real data from GET /api/network
const MOCK_DATA: NetworkDataDTO = {
  players: ['Kendall', 'Matt', 'Brian', 'Monica', 'Michael'],
  rows: [
    { playedAt: '2026-04-25T00:00:00Z', scoresByPlayer: { Kendall: 10, Matt: -10, Brian: 5, Monica: -5, Michael: null } },
    { playedAt: '2026-04-26T00:00:00Z', scoresByPlayer: { Kendall: -8, Matt: 8, Brian: null, Monica: 20, Michael: -20 } },
  ],
};

export default function NetworkPage() {
  const [egoPlayer, setEgoPlayer] = useState<string | null>(null);
  const [minGames, setMinGames] = useState(1);

  return (
    <Card>
      <h1 className="mb-4 text-lg font-extrabold text-ink-900">🌐 Player Network</h1>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-400">
            Ego player (optional)
          </label>
          <select
            value={egoPlayer ?? ''}
            onChange={(e) => setEgoPlayer(e.target.value || null)}
            className="rounded-lg border border-ink-100 px-3 py-2 text-sm"
          >
            <option value="">All players</option>
            {MOCK_DATA.players.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-400">
            Min games together
          </label>
          <input
            type="number"
            min={1}
            value={minGames}
            onChange={(e) => setMinGames(Number(e.target.value))}
            className="w-24 rounded-lg border border-ink-100 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <NetworkGraph data={MOCK_DATA} egoPlayer={egoPlayer} minGamesTogether={minGames} />
    </Card>
  );
}
