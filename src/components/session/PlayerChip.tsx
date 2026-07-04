'use client';

import { useDraggable } from '@dnd-kit/core';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import type { PlayerDTO } from '@/lib/types';

// TODO(dnd-kit): wrap the whole session board in a <DndContext> at the
// page level and handle onDragEnd there to move players between
// table/sideline drop zones — this component only supplies the
// draggable handle + visuals.
export function PlayerChip({ player }: { player: PlayerDTO }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0.5 : 1,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className="flex cursor-grab flex-col items-center gap-1 rounded-lg p-2 text-center active:cursor-grabbing"
    >
      <PlayerAvatar icon={player.icon} name={player.name} size={44} />
      <span className="text-xs font-semibold text-ink-700">{player.name}</span>
    </div>
  );
}
