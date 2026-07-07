"use client";

/**
 * PLAYER NETWORK — /network
 * Ports: network.html (vis-network graph, ego-graph mode, date/threshold filtering)
 *
 * TODO(page):
 *   - [ ] Add the date-range filter (mirrors "Default Timeframe: shows
 *         games from April 25, 2026 onward by default").
 *   - [ ] Multi-select "compare mode" alongside the existing ego-graph mode.
 *
 * KNOWN DATA CAVEAT (imported/legacy games only): discard-win games only
 * ever recorded the winner + discarder as scored participants (see the
 * seed script's header comment) — the other 2 seated players for those
 * historical hands aren't in game_scores at all, so this graph will
 * undercount co-play edges for old discard wins specifically. Self-draw
 * games (all 4 participants scored) and every game recorded going forward
 * through /session (which stores all 4 seats, including 0-scorers) are
 * fully accurate. Nothing to fix here — it's a limitation of what the
 * original spreadsheet recorded, not this page.
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { NetworkGraph } from "@/components/network/NetworkGraph";
import type { NetworkDataDTO } from "@/lib/types";

export default function NetworkPage() {
  const [data, setData] = useState<NetworkDataDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [egoPlayer, setEgoPlayer] = useState<string | null>(null);
  const [minGames, setMinGames] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/network")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load network data.");
        return res.json();
      })
      .then((json: NetworkDataDTO) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Something went wrong.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <p className="text-center text-ink-400">Loading network…</p>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <p className="text-center text-lose">
          ⚠️ {error ?? "No data available."}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-4 text-lg font-extrabold text-ink-900">
        🌐 Player Network
      </h1>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-400">
            Ego player (optional)
          </label>
          <select
            value={egoPlayer ?? ""}
            onChange={(e) => setEgoPlayer(e.target.value || null)}
            className="rounded-lg border border-ink-100 px-3 py-2 text-sm"
          >
            <option value="">All players</option>
            {data.players.map((p) => (
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

      <NetworkGraph
        data={data}
        egoPlayer={egoPlayer}
        minGamesTogether={minGames}
      />
    </Card>
  );
}
