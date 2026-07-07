"use client";

import { useDraggable } from "@dnd-kit/core";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import type { PlayerDTO } from "@/lib/types";

interface PlayerChipProps {
  player: PlayerDTO;
  onRemove?: () => void; // "left for the night" — pulls them out of the session entirely
}

export function PlayerChip({ player, onRemove }: PlayerChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: player.id,
    });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0.5 : 1,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
      className="group relative flex cursor-grab flex-col items-center gap-1 rounded-lg p-2 text-center active:cursor-grabbing"
    >
      {onRemove && (
        <button
          // Stop the pointer-down from bubbling to the draggable handle above,
          // or clicking this would also kick off a drag.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title={`Remove ${player.name} from tonight's session`}
          className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-ink-500 text-[10px] text-white group-hover:flex hover:bg-lose"
        >
          ✕
        </button>
      )}
      <PlayerAvatar icon={player.icon} name={player.name} size={44} />
      <span className="text-xs font-semibold text-ink-700">{player.name}</span>
    </div>
  );
}
