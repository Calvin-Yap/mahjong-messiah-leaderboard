'use client';

import clsx from 'clsx';

interface PlayerFilterChipsProps {
  players: string[];
  selected: Set<string>;
  onToggle: (player: string) => void;
}

export function PlayerFilterChips({ players, selected, onToggle }: PlayerFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => (
        <button
          key={p}
          onClick={() => onToggle(p)}
          className={clsx(
            'rounded-full px-3 py-1 text-xs font-bold',
            selected.has(p) ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-500'
          )}
        >
          {selected.has(p) ? '✓ ' : ''}
          {p}
        </button>
      ))}
    </div>
  );
}
