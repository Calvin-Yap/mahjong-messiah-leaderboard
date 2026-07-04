'use client';

/**
 * DASHBOARD — /dashboard
 * Ports: dashboard.html (Chart.js line/bump charts, date range slider,
 * multi-select player filter, session-player preset).
 *
 * TODO(page):
 *   - [ ] On mount: fetch('/api/dashboard/scores') and fetch('/api/elo/history'),
 *         store in state instead of the MOCK_* constants below.
 *   - [ ] Fetch current session participants (GET /api/sessions?active=true)
 *         to power the "Session Players" quick-filter button.
 *   - [ ] Replace the two plain date inputs with a real dual-range slider
 *         (e.g. `react-range` or a small custom component) matching the
 *         draggable min/max handles in the screenshot.
 *   - [ ] Add the "Rank Over Time" bump chart using LineChartPanel with
 *         reverseYAxis — data already comes back as `ranks` per game from
 *         /api/dashboard/scores.
 *   - [ ] Add the "Average ELO per Game Played" bar chart (Chart.js bar,
 *         not line — new chart type, not yet scaffolded here).
 *   - [ ] "Update Charts" should be the only thing that re-renders the
 *         (possibly expensive) charts — keep filter state separate from
 *         the state actually passed into LineChartPanel, exactly like the
 *         original sidebar's explicit "Update Charts" button.
 */

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlayerFilterChips } from '@/components/dashboard/PlayerFilterChips';
import { LineChartPanel } from '@/components/dashboard/LineChartPanel';

// TODO(api): replace with real data from /api/dashboard/scores + /api/elo/history
const MOCK_PLAYERS = ['Kendall', 'Matt', 'Brian', 'Monica', 'Michael', 'Kesler'];
const MOCK_LABELS = ['03/30', '04/05', '04/12', '04/20', '04/28', '05/05'];
const MOCK_SCORES = MOCK_PLAYERS.map((_, i) =>
  MOCK_LABELS.map((_, j) => (i + 1) * 120 + j * 40 * (i % 2 === 0 ? 1 : -1))
);

export default function DashboardPage() {
  const [selected, setSelected] = useState(new Set(MOCK_PLAYERS));
  const [appliedSelected, setAppliedSelected] = useState(new Set(MOCK_PLAYERS));

  const series = useMemo(
    () =>
      MOCK_PLAYERS.filter((p) => appliedSelected.has(p)).map((p) => ({
        name: p,
        data: MOCK_SCORES[MOCK_PLAYERS.indexOf(p)]!,
      })),
    [appliedSelected]
  );

  function toggle(p: string) {
    const next = new Set(selected);
    next.has(p) ? next.delete(p) : next.add(p);
    setSelected(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h1 className="mb-4 text-lg font-extrabold text-ink-900">📊 Mahjong Dashboard</h1>

        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Players</p>
        <div className="mb-2">
          <span className="mb-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
            🀄 Showing tonight&apos;s session players
          </span>
        </div>
        <PlayerFilterChips players={MOCK_PLAYERS} selected={selected} onToggle={toggle} />

        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-ink-400">
          Date range
        </p>
        {/* TODO: replace with real dual-range slider, see file header TODOs */}
        <div className="mb-4 flex gap-3">
          <input type="datetime-local" className="rounded-lg border border-ink-100 px-3 py-2 text-sm" />
          <input type="datetime-local" className="rounded-lg border border-ink-100 px-3 py-2 text-sm" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAppliedSelected(new Set(selected))}>Update Charts</Button>
          <Button variant="secondary" onClick={() => setSelected(new Set(MOCK_PLAYERS))}>
            Select All
          </Button>
          <Button variant="secondary" onClick={() => setSelected(new Set())}>
            Clear All
          </Button>
          <Button variant="secondary" onClick={() => setSelected(new Set(MOCK_PLAYERS))}>
            Session Players
          </Button>
          <Button variant="secondary" onClick={() => {}}>
            Reset Range
          </Button>
        </div>
      </Card>

      <LineChartPanel
        title="✏️ Cumulative Scores"
        subtitle="Running total points per player over time"
        labels={MOCK_LABELS}
        series={series}
        yLabel="Points"
      />

      <LineChartPanel
        title="🏆 ELO Ratings Over Time"
        subtitle="Skill rating progression — post April 25, 2026"
        labels={MOCK_LABELS}
        series={series.map((s) => ({ ...s, data: s.data.map((v) => v + 1500) }))}
        yLabel="ELO Rating"
      />

      {/* TODO: Rank Over Time (bump chart, reverseYAxis) and
          Average ELO per Game Played (bar chart) panels go here. */}
    </div>
  );
}
