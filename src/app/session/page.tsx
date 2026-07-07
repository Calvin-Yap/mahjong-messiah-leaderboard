"use client";

/**
 * SESSION MANAGER — /session
 * Ports: session_backend.gs + session.html
 *
 * TODO(page, remaining):
 *   - [ ] Supabase Realtime subscription so layout changes and recorded
 *         wins made on another device (e.g. a second phone at the table)
 *         update this view live, instead of only updating the device that
 *         made the change.
 *   - [ ] Wind Drawing: shuffle seat order within a table.
 *   - [ ] Search bar filtering (client-side, over seated + sideline players).
 *   - [ ] Table-full drop is currently a silent no-op — consider a toast/
 *         shake animation so it's clear why the drop didn't work.
 */

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TableCard } from "@/components/session/TableCard";
import { PlayerChip } from "@/components/session/PlayerChip";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { AddPlayerModal } from "@/components/session/AddPlayerModal";
import { RecordWinModal } from "@/components/session/RecordWinModal";
import { WhosHereModal } from "@/components/session/WhosHereModal";
import type { SessionStateDTO, PlayerDTO } from "@/lib/types";

function SidelineDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "sideline" });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-wrap gap-2 rounded-lg border border-dashed p-2 ${
        isOver ? "border-brand-500 bg-brand-50" : "border-ink-100"
      }`}
    >
      {children}
    </div>
  );
}

export default function SessionPage() {
  const [session, setSession] = useState<SessionStateDTO | null>(null);
  const [roster, setRoster] = useState<PlayerDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [whosHereOpen, setWhosHereOpen] = useState(false);
  const [winModalTable, setWinModalTable] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [busyTable, setBusyTable] = useState<number | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [sessionRes, rosterRes] = await Promise.all([
        fetch("/api/sessions?active=true"),
        fetch("/api/players"),
      ]);
      if (!sessionRes.ok || !rosterRes.ok)
        throw new Error("Failed to load session.");
      setSession(await sessionRes.json());
      setRoster(await rosterRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function persistLayout(next: SessionStateDTO) {
    const tables: Record<string, string[]> = {};
    next.tables.forEach(
      (t) => (tables[String(t.tableNumber)] = t.players.map((p) => p.id)),
    );
    const sideline = next.sideline.map((p) => p.id);
    try {
      await fetch(`/api/sessions/${next.id}/layout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables, sideline }),
      });
    } catch {
      setError(
        "Failed to save the last change — it may not persist on reload.",
      );
    }
  }

  function findPlayer(s: SessionStateDTO, id: string): PlayerDTO | undefined {
    return (
      s.sideline.find((p) => p.id === id) ??
      s.tables.flatMap((t) => t.players).find((p) => p.id === id)
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || !session) return;
    const playerId = active.id as string;
    const destination = over.id as string;

    const player = findPlayer(session, playerId);
    if (!player) return;

    const tables = session.tables.map((t) => ({
      ...t,
      players: t.players.filter((p) => p.id !== playerId),
    }));
    let sideline = session.sideline.filter((p) => p.id !== playerId);

    if (destination === "sideline") {
      sideline = [...sideline, player];
    } else {
      const tableNum = Number(destination.replace("table-", ""));
      const idx = tables.findIndex((t) => t.tableNumber === tableNum);
      if (idx === -1) {
        sideline = [...sideline, player]; // unknown drop target, don't lose the player
      } else if (tables[idx]!.players.length >= 4) {
        return; // table full — no-op, leave state untouched (see file TODOs)
      } else {
        tables[idx] = {
          ...tables[idx]!,
          players: [...tables[idx]!.players, player],
        };
      }
    }

    const next: SessionStateDTO = { ...session, tables, sideline };
    setSession(next);
    persistLayout(next);
  }

  async function handleStartSession() {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCount: 2 }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Failed to start session.");
      setSession(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTable() {
    if (!session) return;
    const nextCount = session.tableCount + 1;
    const next: SessionStateDTO = {
      ...session,
      tableCount: nextCount,
      tables: [...session.tables, { tableNumber: nextCount, players: [] }],
    };
    setSession(next);
    await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableCount: nextCount }),
    });
  }

  async function handleDraw(tableNumber: number) {
    if (!session) return;
    const table = session.tables.find((t) => t.tableNumber === tableNumber);
    if (!table || table.players.length !== 4) return;

    setBusyTable(tableNumber);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: table.players.map((p) => p.id),
          isDraw: true,
          sessionId: session.id,
          tableNumber,
        }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Failed to record draw.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyTable(null);
    }
  }

  async function handleRemoveFromSession(playerId: string) {
    if (!session) return;
    const next: SessionStateDTO = {
      ...session,
      tables: session.tables.map((t) => ({
        ...t,
        players: t.players.filter((p) => p.id !== playerId),
      })),
      sideline: session.sideline.filter((p) => p.id !== playerId),
    };
    setSession(next);
    await persistLayout(next);
  }

  async function handleDeleteTable(tableNumber: number) {
    if (!session) return;
    const table = session.tables.find((t) => t.tableNumber === tableNumber);
    if (!table || table.players.length > 0) return; // guard: only ever called on empty tables

    // Renumber remaining tables down by one so numbering stays contiguous
    // (e.g. deleting Table 2 out of 1/2/3 leaves 1/2, not 1/3).
    const remaining = session.tables
      .filter((t) => t.tableNumber !== tableNumber)
      .sort((a, b) => a.tableNumber - b.tableNumber)
      .map((t, i) => ({ ...t, tableNumber: i + 1 }));
    const nextCount = remaining.length;

    const next: SessionStateDTO = {
      ...session,
      tableCount: nextCount,
      tables: remaining,
    };
    setSession(next);
    await Promise.all([
      fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCount: nextCount }),
      }),
      persistLayout(next),
    ]);
  }

  async function handleArchivePlayer(player: PlayerDTO) {
    setRoster((prev) => prev.filter((p) => p.id !== player.id));
    try {
      await fetch(`/api/players/${player.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
    } catch {
      setError(
        `Failed to archive ${player.name} — they may still appear elsewhere.`,
      );
    }
    // In case they were somehow already seated/sidelined when archived.
    if (session && findPlayer(session, player.id)) {
      await handleRemoveFromSession(player.id);
    }
  }

  const availableForWhosHere = roster.filter(
    (p) => !session || !findPlayer(session, p.id),
  );
  const activeDragPlayer =
    session && activeDragId ? findPlayer(session, activeDragId) : undefined;
  const activeTable = session?.tables.find(
    (t) => t.tableNumber === winModalTable,
  );

  if (loading) {
    return (
      <Card>
        <p className="text-center text-ink-400">Loading session…</p>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="mx-auto max-w-sm text-center">
        <p className="mb-4 text-ink-500">No session running right now.</p>
        <Button onClick={handleStartSession}>🀄 Start Session</Button>
        {error && <p className="mt-3 text-sm text-lose">⚠️ {error}</p>}
      </Card>
    );
  }

  const totalPlayers =
    session.tables.reduce((n, t) => n + t.players.length, 0) +
    session.sideline.length;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="mx-auto max-w-md">
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-lose">
            ⚠️ {error}
          </div>
        )}

        <Card className="mb-4 bg-brand-gradient text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide opacity-80">
                🀄 Session
              </p>
              <p className="text-sm">
                {totalPlayers} players · {session.tableCount} tables
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="!bg-white/20 !text-white"
                onClick={() => setWhosHereOpen(true)}
              >
                🙋 Who&apos;s Here
              </Button>
              <Button
                variant="secondary"
                className="!bg-white/20 !text-white"
                onClick={() => setAddPlayerOpen(true)}
              >
                + Player
              </Button>
            </div>
          </div>
        </Card>

        <Card className="mb-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-400">
            🏮 Sideline{" "}
            <span className="rounded-full bg-brand-100 px-1.5 text-brand-600">
              {session.sideline.length}
            </span>
          </p>
          <SidelineDropZone>
            {session.sideline.length === 0 ? (
              <span className="p-2 text-xs text-ink-300">
                Drag players here, or use &quot;Who&apos;s Here&quot; to add
                some.
              </span>
            ) : (
              session.sideline.map((p) => (
                <PlayerChip
                  key={p.id}
                  player={p}
                  onRemove={() => handleRemoveFromSession(p.id)}
                />
              ))
            )}
          </SidelineDropZone>
        </Card>

        <div className="flex flex-col gap-4">
          {session.tables.map((table) => (
            <TableCard
              key={table.tableNumber}
              table={table}
              busy={busyTable === table.tableNumber}
              onRecordWin={setWinModalTable}
              onDraw={handleDraw}
              onDeleteTable={handleDeleteTable}
              onRemovePlayer={handleRemoveFromSession}
            />
          ))}
        </div>

        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={handleAddTable}
        >
          + Add Table
        </Button>

        {addPlayerOpen && (
          <AddPlayerModal
            existingIcons={roster.map((p) => p.icon ?? "")}
            onClose={() => setAddPlayerOpen(false)}
            onCreated={(newPlayer) => {
              setRoster((prev) => [...prev, newPlayer]);
              const next: SessionStateDTO = {
                ...session,
                sideline: [...session.sideline, newPlayer],
              };
              setSession(next);
              persistLayout(next);
            }}
          />
        )}

        {whosHereOpen && (
          <WhosHereModal
            availablePlayers={availableForWhosHere}
            onClose={() => setWhosHereOpen(false)}
            onArchive={handleArchivePlayer}
            onConfirm={(selected) => {
              const next: SessionStateDTO = {
                ...session,
                sideline: [...session.sideline, ...selected],
              };
              setSession(next);
              persistLayout(next);
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
              // Players stay seated for the next hand — see file header.
              // TODO: refetch leaderboard/ELO state elsewhere on next visit.
            }}
          />
        )}
      </div>

      <DragOverlay>
        {activeDragPlayer ? (
          <div className="rounded-lg bg-white p-2 shadow-card">
            <PlayerAvatar
              icon={activeDragPlayer.icon}
              name={activeDragPlayer.name}
              size={44}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
