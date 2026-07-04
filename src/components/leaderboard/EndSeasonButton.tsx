'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface EndSeasonButtonProps {
  activeSeasonId: string;
  activeSeasonName: string;
  nextSeasonNumber: number;
}

// Confirmation-gated action: snapshots the active season into
// season_history (permanent) and starts the next one. Does NOT delete
// any raw game data — see prisma/sql/end_season.sql for why that's a
// deliberately separate, manual step.
export function EndSeasonButton({
  activeSeasonId,
  activeSeasonName,
  nextSeasonNumber,
}: EndSeasonButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nextName, setNextName] = useState(`Season ${nextSeasonNumber}`);
  const [resetElo, setResetElo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      // TODO(backup): trigger the raw-data export here before calling
      // close, per the TODO in /api/seasons/[id]/close/route.ts.
      const res = await fetch(`/api/seasons/${activeSeasonId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextSeasonName: nextName, resetElo }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to end season.');
      setOpen(false);
      router.refresh(); // leaderboard + hall-of-fame will reflect the new empty season
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        🏁 End {activeSeasonName}
      </Button>

      {open && (
        <Modal title="End Season?" onClose={() => setOpen(false)}>
          <p className="mb-4 text-sm text-ink-500">
            This snapshots every player&apos;s final rank, score, and ELO from{' '}
            <strong>{activeSeasonName}</strong> into the permanent Hall of Fame record, then
            starts a new season. Raw game history is kept — nothing is deleted.
          </p>

          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-400">
            Next season name
          </label>
          <input
            value={nextName}
            onChange={(e) => setNextName(e.target.value)}
            className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />

          <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={resetElo} onChange={(e) => setResetElo(e.target.checked)} />
            Reset everyone&apos;s ELO to 1500 for the new season
          </label>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-lose">⚠️ {error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting ? 'Ending Season…' : 'Confirm & End Season'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
