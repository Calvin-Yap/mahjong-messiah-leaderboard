'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { computeFanScores, MIN_FAN, MAX_FAN } from '@/lib/scoring';
import type { PlayerDTO } from '@/lib/types';
import clsx from 'clsx';

interface RecordWinModalProps {
  tableNumber: number;
  sessionId: string;
  seatedPlayers: PlayerDTO[]; // exactly 4
  onClose: () => void;
  onRecorded: () => void; // TODO(realtime): also fires on the Realtime broadcast, not just this device
}

// Direct port of the "Winner → Fan → Win Type → Discarder → Preview" flow
// from buildFanGameSidebar() in code.gs, scoped to one table in a live session.
export function RecordWinModal({
  tableNumber,
  sessionId,
  seatedPlayers,
  onClose,
  onRecorded,
}: RecordWinModalProps) {
  const [winner, setWinner] = useState<string | null>(null);
  const [fan, setFan] = useState<number | ''>('');
  const [isSelfDraw, setIsSelfDraw] = useState(false);
  const [loser, setLoser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const players = seatedPlayers.map((p) => p.id);
  const nonWinners = seatedPlayers.filter((p) => p.id !== winner);

  let preview: Record<string, number> | null = null;
  try {
    if (winner && fan !== '' && (isSelfDraw || loser)) {
      preview = computeFanScores({
        players: players as [string, string, string, string],
        winner,
        fan,
        isSelfDraw,
        loser: loser ?? undefined,
      });
    }
  } catch {
    preview = null;
  }

  async function handleSubmit() {
    if (!preview || !winner || fan === '') return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players,
          winner,
          fan,
          isSelfDraw,
          loser: isSelfDraw ? undefined : loser,
          sessionId,
          tableNumber,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to record win.');
      onRecorded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`👑 Record Win — Table ${tableNumber}`} onClose={onClose}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Winner</p>
      <div className="mb-4 flex flex-col gap-1">
        {seatedPlayers.map((p) => (
          <label
            key={p.id}
            className={clsx(
              'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              winner === p.id ? 'border-brand-500 bg-brand-50 font-semibold' : 'border-ink-100'
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
        onChange={(e) => setFan(e.target.value ? Number(e.target.value) : '')}
        placeholder="e.g. 5"
        className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />

      <label
        className={clsx(
          'mb-4 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold',
          isSelfDraw ? 'border-win bg-green-50' : 'border-ink-100'
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
            value={loser ?? ''}
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

      {preview && (
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-brand-gradient p-3 text-white">
          {Object.entries(preview).map(([id, score]) => {
            const name = seatedPlayers.find((p) => p.id === id)?.name;
            return (
              <div key={id} className="rounded-lg bg-white/15 px-2 py-1.5">
                <div className="text-xs opacity-80">
                  {id === winner ? '👑' : '👤'} {name}
                </div>
                <div className="text-sm font-extrabold">
                  {score > 0 ? '+' : ''}
                  {score}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-lose">⚠️ {error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!preview || submitting}>
          {submitting ? 'Saving…' : 'Add Game'}
        </Button>
      </div>
    </Modal>
  );
}
