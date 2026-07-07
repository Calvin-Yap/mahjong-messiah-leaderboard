"use client";

/**
 * GAME HISTORY — /games
 * New page: browse every recorded game, searchable by player name,
 * paginated server-side (895+ games from the historical import alone —
 * shipping them all to the client at once would be slow and wasteful).
 *
 * TODO(page):
 *   - [ ] Add a win-type filter (discard / self-draw / manual)
 *   - [ ] Add a date-range filter alongside the player search
 *   - [ ] Link each row's player names to a per-player detail view, once
 *         one exists
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { EditGameModal } from "@/components/games/EditGameModal";
import type { GamesListDTO, GameRowDTO } from "@/lib/types";

const PAGE_SIZE = 25;

const WIN_TYPE_LABEL: Record<string, string> = {
  discard: "💥 Discard",
  self_draw: "🀄 Self-Draw",
  draw: "🤝 Draw",
  manual: "✏️ Manual",
};

export default function GamesPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<GamesListDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [editingGame, setEditingGame] = useState<GameRowDTO | null>(null);

  // Debounce the search box so we're not firing a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1); // reset to page 1 whenever the search term changes
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      q: debouncedQuery,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    fetch(`/api/games?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load games.");
        return res.json();
      })
      .then((json: GamesListDTO) => {
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
  }, [debouncedQuery, page, refreshIndex]);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-ink-900">
            🀄 Game History
          </h1>
          {data && (
            <span className="text-xs text-ink-400">
              {data.total} game{data.total === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Search by player name…"
          className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </Card>

      {error && (
        <Card>
          <p className="text-center text-lose">⚠️ {error}</p>
        </Card>
      )}

      {!error && loading && (
        <Card>
          <p className="text-center text-ink-400">Loading…</p>
        </Card>
      )}

      {!error && !loading && data?.games.length === 0 && (
        <Card>
          <p className="text-center text-ink-400">
            No games found{debouncedQuery ? ` for "${debouncedQuery}"` : ""}.
          </p>
        </Card>
      )}

      {!error &&
        !loading &&
        data?.games.map((game) => (
          <Card key={game.id}>
            <div className="mb-3 flex items-center justify-between text-xs text-ink-400">
              <span>
                {new Date(game.playedAt).toLocaleString()}
                {game.tableNumber != null ? ` · Table ${game.tableNumber}` : ""}
              </span>
              <span className="flex items-center gap-2">
                {game.winType && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 font-bold text-ink-500">
                    {WIN_TYPE_LABEL[game.winType]}
                  </span>
                )}
                {game.fan != null && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-bold text-brand-600">
                    {game.fan} fan
                  </span>
                )}
                <button
                  onClick={() => setEditingGame(game)}
                  aria-label="Edit game"
                  className="rounded-full px-2 py-0.5 font-bold text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                >
                  ✏️ Edit
                </button>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {game.scores.map((s) => (
                <div
                  key={s.playerName}
                  className="flex items-center gap-2 rounded-lg border border-ink-100 px-2 py-1.5"
                >
                  <PlayerAvatar icon={s.icon} name={s.playerName} size={28} />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-ink-700">
                      {s.playerName === game.winnerName ? "👑 " : ""}
                      {s.playerName}
                    </div>
                    <div
                      className={
                        s.score > 0
                          ? "text-sm font-extrabold text-win"
                          : s.score < 0
                            ? "text-sm font-extrabold text-lose"
                            : "text-sm font-extrabold text-ink-400"
                      }
                    >
                      {s.score > 0 ? "+" : ""}
                      {s.score}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}

      {!error && !loading && data && data.total > 0 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </Button>
          <span className="text-sm text-ink-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </Button>
        </div>
      )}

      {editingGame && (
        <EditGameModal
          game={editingGame}
          onClose={() => setEditingGame(null)}
          onSaved={() => setRefreshIndex((n) => n + 1)}
        />
      )}
    </div>
  );
}
