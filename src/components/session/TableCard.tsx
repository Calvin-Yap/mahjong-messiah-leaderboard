"use client";

import { useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { PlayerChip } from "@/components/session/PlayerChip";
import type { SessionTableDTO } from "@/lib/types";

interface TableCardProps {
  table: SessionTableDTO;
  onRecordWin: (tableNumber: number) => void;
  onDraw: (tableNumber: number) => void;
  onDeleteTable: (tableNumber: number) => void;
  onRemovePlayer: (playerId: string) => void;
  busy?: boolean; // disables both action buttons while a game submission is in flight
}

// Matches the "Table 1 / Table 2" cards in the Session Manager screenshot:
// green border + "Ready" badge when 4 seats are filled, 4 player slots,
// and a Draw / Winner action row.
export function TableCard({
  table,
  onRecordWin,
  onDraw,
  onDeleteTable,
  onRemovePlayer,
  busy = false,
}: TableCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `table-${table.tableNumber}`,
  });
  const isReady = table.players.length === 4;
  const isEmpty = table.players.length === 0;

  return (
    <Card
      className={clsx(
        "border-2",
        isReady
          ? "border-win"
          : isOver
            ? "border-brand-500"
            : "border-transparent",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-extrabold text-ink-900">
          🀄 Table {table.tableNumber}
        </span>
        <div className="flex items-center gap-2">
          {isReady && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
              ✓ Ready
            </span>
          )}
          {isEmpty && (
            <button
              onClick={() => onDeleteTable(table.tableNumber)}
              title="Delete this empty table"
              className="text-xs font-bold text-ink-300 hover:text-lose"
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className="mb-3 grid min-h-[96px] grid-cols-2 gap-2"
      >
        {table.players.map((p) => (
          <PlayerChip
            key={p.id}
            player={p}
            onRemove={() => onRemovePlayer(p.id)}
          />
        ))}
        {/* TODO(dnd-kit): render empty-seat placeholders for 4 - players.length
            so the drop target area stays visually consistent even when a
            table is only partially filled. */}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onDraw(table.tableNumber)}
          disabled={!isReady || busy}
          className="flex-1 rounded-lg bg-ink-50 py-2 text-xs font-bold text-ink-500 hover:bg-ink-100 disabled:opacity-40"
        >
          🤝 {busy ? "Saving…" : "Draw (0 pts)"}
        </button>
        <button
          onClick={() => onRecordWin(table.tableNumber)}
          disabled={!isReady || busy}
          className="flex-1 rounded-lg bg-brand-50 py-2 text-xs font-bold text-brand-600 hover:bg-brand-100 disabled:opacity-40"
        >
          👑 Winner…
        </button>
      </div>
    </Card>
  );
}
