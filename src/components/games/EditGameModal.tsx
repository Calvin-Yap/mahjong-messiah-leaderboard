"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { computeFanScores, MIN_FAN, MAX_FAN } from "@/lib/scoring";
import type { GameRowDTO } from "@/lib/types";
import clsx from "clsx";

interface EditGameModalProps {
  game: GameRowDTO;
  onClose: () => void;
  onSaved: () => void; // refetch the games list
}

type Mode = "fan" | "draw" | "raw";

function initialMode(game: GameRowDTO): Mode {
  if (game.winType === "discard" || game.winType === "self_draw") return "fan";
  if (game.winType === "draw") return "draw";
  return "raw"; // manual/legacy or null — no fan/winner structure to assume
}

// Correct a mistake in an already-recorded game, or delete it outright.
// Never lets the player set change — only the outcome — since swapping a
// player is really "this game shouldn't exist, and a different one should."
export function EditGameModal({ game, onClose, onSaved }: EditGameModalProps) {
  const players = game.scores.map((s) => ({
    id: s.playerId,
    name: s.playerName,
  }));

  const [mode, setMode] = useState<Mode>(initialMode(game));
  const [winner, setWinner] = useState<string | null>(game.winnerId);
  const [fan, setFan] = useState<number | "">(game.fan ?? "");
  const [isSelfDraw, setIsSelfDraw] = useState(game.winType === "self_draw");
  const [loser, setLoser] = useState<string | null>(game.loserId);
  const [rawScores, setRawScores] = useState<Record<string, string>>(
    Object.fromEntries(game.scores.map((s) => [s.playerId, String(s.score)])),
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const nonWinners = players.filter((p) => p.id !== winner);
  const canUseFanMode = players.length === 4;

  let fanPreview: Record<string, number> | null = null;
  if (mode === "fan") {
    try {
      if (winner && fan !== "" && (isSelfDraw || loser)) {
        fanPreview = computeFanScores({
          players: players.map((p) => p.id) as [string, string, string, string],
          winner,
          fan,
          isSelfDraw,
          loser: loser ?? undefined,
        });
      }
    } catch {
      fanPreview = null;
    }
  }

  const rawTotal = Object.values(rawScores).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0,
  );
  const rawValid =
    mode !== "raw" ||
    (rawTotal === 0 &&
      Object.values(rawScores).every(
        (v) => v.trim() !== "" && !Number.isNaN(Number(v)),
      ));

  const canSubmit =
    mode === "draw" ? true : mode === "fan" ? !!fanPreview : rawValid;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const body =
        mode === "draw"
          ? { mode: "draw" }
          : mode === "fan"
            ? {
                mode: "fan",
                winner,
                fan,
                isSelfDraw,
                loser: isSelfDraw ? undefined : loser,
              }
            : {
                mode: "raw",
                scores: Object.fromEntries(
                  Object.entries(rawScores).map(([id, v]) => [id, Number(v)]),
                ),
              };
      const res = await fetch(`/api/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Failed to save changes.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${game.id}`, { method: "DELETE" });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Failed to delete game.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
    }
  }

  return (
    <Modal title="✏️ Edit Game" onClose={onClose}>
      <div className="mb-4 flex gap-1 rounded-lg bg-ink-50 p-1">
        {canUseFanMode && (
          <button
            onClick={() => setMode("fan")}
            className={clsx(
              "flex-1 rounded-md py-1.5 text-xs font-bold transition",
              mode === "fan"
                ? "bg-white text-ink-900 shadow-sm"
                : "text-ink-400",
            )}
          >
            Fan Win
          </button>
        )}
        <button
          onClick={() => setMode("draw")}
          className={clsx(
            "flex-1 rounded-md py-1.5 text-xs font-bold transition",
            mode === "draw"
              ? "bg-white text-ink-900 shadow-sm"
              : "text-ink-400",
          )}
        >
          Draw
        </button>
        <button
          onClick={() => setMode("raw")}
          className={clsx(
            "flex-1 rounded-md py-1.5 text-xs font-bold transition",
            mode === "raw" ? "bg-white text-ink-900 shadow-sm" : "text-ink-400",
          )}
        >
          Raw Scores
        </button>
      </div>

      {mode === "fan" && (
        <>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
            Winner
          </p>
          <div className="mb-4 flex flex-col gap-1">
            {players.map((p) => (
              <label
                key={p.id}
                className={clsx(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  winner === p.id
                    ? "border-brand-500 bg-brand-50 font-semibold"
                    : "border-ink-100",
                )}
              >
                <input
                  type="radio"
                  name="winner"
                  checked={winner === p.id}
                  onChange={() => {
                    setWinner(p.id);
                    setLoser(null);
                  }}
                />
                {p.name}
              </label>
            ))}
          </div>

          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">
            Fan ({MIN_FAN}–{MAX_FAN})
          </p>
          <input
            type="number"
            min={MIN_FAN}
            max={MAX_FAN}
            value={fan}
            onChange={(e) =>
              setFan(e.target.value ? Number(e.target.value) : "")
            }
            className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />

          <label
            className={clsx(
              "mb-4 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
              isSelfDraw ? "border-win bg-green-50" : "border-ink-100",
            )}
          >
            <input
              type="checkbox"
              checked={isSelfDraw}
              onChange={(e) => setIsSelfDraw(e.target.checked)}
            />
            Self-Draw (自摸)
          </label>

          {!isSelfDraw && winner && (
            <>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">
                Discarder (loser)
              </p>
              <select
                value={loser ?? ""}
                onChange={(e) => setLoser(e.target.value || null)}
                className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm"
              >
                <option value="">Select discarder…</option>
                {nonWinners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {fanPreview && (
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-brand-gradient p-3 text-white">
              {Object.entries(fanPreview).map(([id, score]) => {
                const name = players.find((p) => p.id === id)?.name;
                return (
                  <div key={id} className="rounded-lg bg-white/15 px-2 py-1.5">
                    <div className="text-xs opacity-80">
                      {id === winner ? "👑" : "👤"} {name}
                    </div>
                    <div className="text-sm font-extrabold">
                      {score > 0 ? "+" : ""}
                      {score}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {mode === "draw" && (
        <p className="mb-4 rounded-lg bg-ink-50 px-3 py-3 text-sm text-ink-500">
          🤝 All {players.length} players will be set to a score of 0.
        </p>
      )}

      {mode === "raw" && (
        <>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
            Scores (must sum to 0)
          </p>
          <div className="mb-2 flex flex-col gap-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="w-24 truncate text-sm font-semibold text-ink-700">
                  {p.name}
                </span>
                <input
                  type="number"
                  value={rawScores[p.id] ?? ""}
                  onChange={(e) =>
                    setRawScores((prev) => ({
                      ...prev,
                      [p.id]: e.target.value,
                    }))
                  }
                  className="flex-1 rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <p
            className={clsx(
              "mb-4 text-xs font-semibold",
              rawTotal === 0 ? "text-ink-400" : "text-lose",
            )}
          >
            Total: {rawTotal} {rawTotal !== 0 && "— must equal 0"}
          </p>
        </>
      )}

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-lose">
          ⚠️ {error}
        </p>
      )}

      {!confirmingDelete ? (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
            🗑️ Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-lose/30 bg-red-50 p-3">
          <p className="mb-3 text-sm font-semibold text-ink-700">
            Delete this game permanently? This also recalculates ELO for every
            game after it. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              className="!bg-lose hover:!bg-lose/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Yes, delete it"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
