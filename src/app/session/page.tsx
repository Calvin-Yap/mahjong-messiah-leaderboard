'use client';

/**
 * SESSION MANAGER — /session
 * Ports: session_backend.gs + session.html
 *
 * TODO(page):
 *   - [ ] On mount, GET /api/sessions?active=true to resume today's session
 *         (or show an "Open Session" empty state if none is active).
 *   - [ ] Wrap the board in <DndContext onDragEnd={...}> from @dnd-kit/core;
 *         on drop, move the player between tables/sideline in local state,
 *         then PATCH /api/sessions/:id/layout (debounced).
 *   - [ ] Subscribe to a Supabase Realtime channel for this session id so
 *         layout changes and recorded wins made on another device (e.g. a
 *         second phone at the table) update this view live.
 *   - [ ] "Wind Drawing": add a button per table that calls a
 *         POST /api/sessions/:id/tables/:n/shuffle-seats endpoint (TODO,
 *         not yet scaffolded) and animates the resulting seat order.
 *   - [ ] Search bar: client-side filter over all seated + sideline players
 *         by name, matching the existing sidebar's "Search table or player…".
 *   - [ ] "Close Session": PATCH session { active: false, endedAt: now() }.
 *   - [ ] Add table button: increase tableCount and add an empty TableCard.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TableCard } from '@/components/session/TableCard';
import { PlayerChip } from '@/components/session/PlayerChip';
import { AddPlayerModal } from '@/components/session/AddPlayerModal';
import { RecordWinModal } from '@/components/session/RecordWinModal';
import type { SessionStateDTO } from '@/lib/types';

// TODO(api): replace with the real session fetched from GET /api/sessions?active=true
const MOCK_SESSION: SessionStateDTO = {
  id: 'mock-session-id',
  active: true,
  tableCount: 2,
  tables: [
    {
      tableNumber: 1,
      players: [
        { id: 'p1', name: 'Brown', icon: '🦊' },
        { id: 'p2', name: 'Matt', icon: '🐻' },
        { id: 'p3', name: 'Monica', icon: '🌸' },
        { id: 'p4', name: 'Liam', icon: '🎧' },
      ],
    },
    {
      tableNumber: 2,
      players: [
        { id: 'p5', name: 'Michael', icon: '🐉' },
        { id: 'p6', name: 'Tiffany H', icon: '🎀' },
        { id: 'p7', name: 'Kendall', icon: '🌙' },
        { id: 'p8', name: 'Brian', icon: '🍓' },
      ],
    },
  ],
  sideline: [
    { id: 'p9', name: 'Yellow', icon: '🍋' },
    { id: 'p10', name: 'Kesler', icon: '🦖' },
  ],
};

export default function SessionPage() {
  const [session] = useState<SessionStateDTO>(MOCK_SESSION);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [winModalTable, setWinModalTable] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const totalPlayers =
    session.tables.reduce((n, t) => n + t.players.length, 0) + session.sideline.length;

  const activeTable = session.tables.find((t) => t.tableNumber === winModalTable);

  return (
    <div className="mx-auto max-w-md">
      <Card className="mb-4 bg-brand-gradient text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">🀄 Session</p>
            <p className="text-sm">
              {totalPlayers} players · {session.tableCount} tables
            </p>
          </div>
          <Button
            variant="secondary"
            className="!bg-white/20 !text-white"
            onClick={() => setAddPlayerOpen(true)}
          >
            + Player
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-400">
          🏮 Sideline <span className="rounded-full bg-brand-100 px-1.5 text-brand-600">{session.sideline.length}</span>
        </p>
        <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-ink-100 p-2">
          {session.sideline.map((p) => (
            <PlayerChip key={p.id} player={p} />
          ))}
        </div>
      </Card>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search table or player…"
        className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />

      <div className="flex flex-col gap-4">
        {session.tables.map((table) => (
          <TableCard
            key={table.tableNumber}
            table={table}
            onRecordWin={setWinModalTable}
            onDraw={(n) => {
              // TODO(api): POST /api/games with a zero-score "draw" shape,
              // or a dedicated draw endpoint if draws shouldn't affect ELO.
              console.log('Record draw for table', n);
            }}
          />
        ))}
      </div>

      {addPlayerOpen && (
        <AddPlayerModal
          existingIcons={[
            ...session.tables.flatMap((t) => t.players.map((p) => p.icon ?? '')),
            ...session.sideline.map((p) => p.icon ?? ''),
          ]}
          onClose={() => setAddPlayerOpen(false)}
          onCreated={() => {
            // TODO: refetch session/player list so the new player appears
            // in the sideline immediately.
          }}
        />
      )}

      {activeTable && (
        <RecordWinModal
          tableNumber={activeTable.tableNumber}
          sessionId={session.id}
          seatedPlayers={activeTable.players}
          onClose={() => setWinModalTable(null)}
          onRecorded={() => {
            // TODO: refetch session + leaderboard/ELO state after a win is recorded.
          }}
        />
      )}
    </div>
  );
}
