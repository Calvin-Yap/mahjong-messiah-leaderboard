"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import type { PlayerDTO } from "@/lib/types";

interface WhosHereModalProps {
  availablePlayers: PlayerDTO[]; // full roster minus anyone already in the session
  onClose: () => void;
  onConfirm: (selected: PlayerDTO[]) => void; // added straight to the sideline
  onArchive: (player: PlayerDTO) => void; // "left the club" — permanent, confirmed inline
}

// "Select players who are here" — a checklist over the full roster, scoped
// to whoever isn't already seated/sidelined in the current session. Also
// doubles as the natural place to archive someone who's quit the club —
// they're rarely both "here tonight" and "leaving the club" at once, so
// scoping the archive action to this same list (rather than a separate
// roster-management page) keeps this simple.
export function WhosHereModal({
  availablePlayers,
  onClose,
  onConfirm,
  onArchive,
}: WhosHereModalProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmArchive, setConfirmArchive] = useState<PlayerDTO | null>(null);

  function toggle(id: string) {
    const next = new Set(checked);
    next.has(id) ? next.delete(id) : next.add(id);
    setChecked(next);
  }

  return (
    <Modal title="🙋 Who's Here Tonight?" onClose={onClose}>
      {availablePlayers.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-400">
          Everyone in the roster is already in this session.
        </p>
      ) : (
        <div className="mb-4 flex max-h-80 flex-col gap-1 overflow-y-auto">
          {availablePlayers.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-50"
            >
              <label className="flex flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <PlayerAvatar icon={p.icon} name={p.name} size={28} />
                <span className="text-sm font-semibold text-ink-700">
                  {p.name}
                </span>
              </label>

              {confirmArchive?.id === p.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onArchive(p);
                      setConfirmArchive(null);
                    }}
                    className="rounded-md bg-lose px-2 py-1 text-xs font-bold text-white"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmArchive(null)}
                    className="rounded-md bg-ink-100 px-2 py-1 text-xs font-bold text-ink-500"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmArchive(p)}
                  title={`Archive ${p.name} — they've left the club`}
                  className="text-xs font-bold text-ink-300 hover:text-lose"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={checked.size === 0}
          onClick={() => {
            onConfirm(availablePlayers.filter((p) => checked.has(p.id)));
            onClose();
          }}
        >
          Add {checked.size > 0 ? checked.size : ""} to Sideline
        </Button>
      </div>
    </Modal>
  );
}
