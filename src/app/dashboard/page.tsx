"use client";

/**
 * DASHBOARD — /dashboard
 * Ports: dashboard.html (Chart.js line/bump charts, date range slider,
 * multi-select player filter, session-player preset).
 *
 * TODO(page):
 *   - [ ] "Session Players" currently behaves like "Select All" — wire it to
 *         GET /api/sessions?active=true once /session has a real backing
 *         session, and filter to that session's seated + sideline players.
 *   - [ ] Replace the two plain date inputs with a real dual-range slider
 *         (e.g. `react-range`) and actually filter `data` by the selected
 *         range before rendering — the inputs render but don't filter yet.
 *   - [ ] Add the "Rank Over Time" bump chart using LineChartPanel with
 *         reverseYAxis — `ranks` is already returned per game by the API.
 *   - [ ] Add the "Average ELO per Game Played" bar chart (Chart.js bar,
 *         not line — new chart type, not yet scaffolded here).
 */

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PlayerFilterChips } from "@/components/dashboard/PlayerFilterChips";
import { LineChartPanel } from "@/components/dashboard/LineChartPanel";
import type { DashboardScoresDTO, EloHistoryDTO } from "@/lib/types";

export default function DashboardPage() {
  const [scores, setScores] = useState<DashboardScoresDTO | null>(null);
  const [eloHistory, setEloHistory] = useState<EloHistoryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [appliedSelected, setAppliedSelected] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [scoresRes, eloRes] = await Promise.all([
          fetch("/api/dashboard/scores"),
          fetch("/api/elo/history"),
        ]);
        if (!scoresRes.ok || !eloRes.ok)
          throw new Error("Failed to load dashboard data.");
        const scoresData: DashboardScoresDTO = await scoresRes.json();
        const eloData: EloHistoryDTO = await eloRes.json();
        if (cancelled) return;

        setScores(scoresData);
        setEloHistory(eloData);
        setSelected(new Set());
        setAppliedSelected(new Set());
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Something went wrong.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const scoreLabels = useMemo(
    () => scores?.data.map((d) => d.time) ?? [],
    [scores],
  );
  const scoreSeries = useMemo(() => {
    if (!scores) return [];
    return scores.players
      .map((name, i) => ({
        name,
        data: scores.data.map((d) => d.cumulative[i] ?? null),
      }))
      .filter((s) => appliedSelected.has(s.name));
  }, [scores, appliedSelected]);

  const eloLabels = useMemo(
    () => eloHistory?.data.map((d) => d.time) ?? [],
    [eloHistory],
  );
  const eloSeries = useMemo(() => {
    if (!eloHistory) return [];
    return eloHistory.players
      .map((name, i) => ({
        name,
        data: eloHistory.data.map((d) => d.ratings[i] ?? null),
      }))
      .filter((s) => appliedSelected.has(s.name));
  }, [eloHistory, appliedSelected]);

  function toggle(p: string) {
    const next = new Set(selected);
    if (next.has(p)) {
      next.delete(p);
    } else {
      next.add(p);
    }
    setSelected(next);
  }

  if (loading) {
    return (
      <Card>
        <p className="text-center text-ink-400">Loading dashboard…</p>
      </Card>
    );
  }

  if (error || !scores) {
    return (
      <Card>
        <p className="text-center text-lose">
          ⚠️ {error ?? "No data available yet — add some games first."}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h1 className="mb-4 text-lg font-extrabold text-ink-900">
          📊 Mahjong Dashboard
        </h1>

        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
          Players
        </p>
        <PlayerFilterChips
          players={scores.players}
          selected={selected}
          onToggle={toggle}
        />

        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-ink-400">
          Date range
        </p>
        {/* TODO: wire these up to actually filter — see file header TODOs */}
        <div className="mb-4 flex gap-3">
          <input
            type="datetime-local"
            className="rounded-lg border border-ink-100 px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            className="rounded-lg border border-ink-100 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAppliedSelected(new Set(selected))}>
            Update Charts
          </Button>
          <Button
            variant="secondary"
            onClick={() => setSelected(new Set(scores.players))}
          >
            Select All
          </Button>
          <Button variant="secondary" onClick={() => setSelected(new Set())}>
            Clear All
          </Button>
          <Button
            variant="secondary"
            onClick={() => setSelected(new Set(scores.players))}
          >
            Session Players
          </Button>
          <Button variant="secondary" onClick={() => {}}>
            Reset Range
          </Button>
        </div>
      </Card>

      {scoreSeries.length === 0 ? (
        <Card>
          <p className="text-center text-ink-400">
            Select at least one player to see charts.
          </p>
        </Card>
      ) : (
        <>
          <LineChartPanel
            title="✏️ Cumulative Scores"
            subtitle="Running total points per player over time"
            labels={scoreLabels}
            series={scoreSeries}
            yLabel="Points"
          />

          <LineChartPanel
            title="🏆 ELO Ratings Over Time"
            subtitle="Skill rating progression — post April 25, 2026"
            labels={eloLabels}
            series={eloSeries}
            yLabel="ELO Rating"
          />
        </>
      )}

      {/* TODO: Rank Over Time (bump chart, reverseYAxis) and
          Average ELO per Game Played (bar chart) panels go here. */}
    </div>
  );
}
