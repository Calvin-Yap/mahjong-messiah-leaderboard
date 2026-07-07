"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartData,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

// Distinct, high-contrast palette — ported from the color set used in the
// original dashboard.html so returning users see familiar player colors.
export const PLAYER_COLORS = [
  "#e53e3e",
  "#3182ce",
  "#68d391",
  "#d53f8c",
  "#38b2ac",
  "#dd6b20",
  "#4299e1",
  "#d69e2e",
  "#276749",
  "#805ad5",
  "#38a169",
  "#c53030",
];

interface LineChartPanelProps {
  title: string;
  subtitle: string;
  labels: string[];
  series: { name: string; data: (number | null)[] }[];
  yLabel?: string;
  reverseYAxis?: boolean; // for the "rank over time" bump chart (1 = best, at top)
  /**
   * Fixed Y-axis bounds. Pass these computed from the FULL, unfiltered
   * dataset (not just the currently-selected players) so the axis stays
   * put when someone toggles players on/off — without this, Chart.js
   * auto-scales to whatever's currently visible, which is what caused
   * the axis to visibly jump/stretch on every selection change.
   */
  yMin?: number;
  yMax?: number;
}

// TODO(interactivity): wire up "click legend to toggle player" — Chart.js
// supports this out of the box via the legend's onClick handler, ported
// from the original dashboard.html behavior.
export function LineChartPanel({
  title,
  subtitle,
  labels,
  series,
  yLabel,
  reverseYAxis,
  yMin,
  yMax,
}: LineChartPanelProps) {
  const data: ChartData<"line"> = {
    labels,
    datasets: series.map((s, i) => ({
      label: s.name,
      data: s.data,
      borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
      backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
      tension: 0.25,
      spanGaps: true,
      pointRadius: 0,
    })),
  };

  return (
    <div className="rounded-card border border-ink-100 bg-white p-5 shadow-card">
      <h3 className="text-sm font-extrabold text-ink-900">{title}</h3>
      <p className="mb-4 text-xs text-ink-400">{subtitle}</p>
      {/*
        CRITICAL: Chart.js + maintainAspectRatio:false requires an explicitly
        sized parent — without it the canvas has no bound to size itself
        against and can grow without limit (this, not just the axis
        auto-scaling, was the "stretches indefinitely" bug). The `height`
        prop on <Line> alone does NOT guarantee this once
        maintainAspectRatio is false; the wrapping div's fixed height is
        what actually constrains it.
      */}
      <div className="relative h-72 sm:h-80">
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                reverse: reverseYAxis,
                min: yMin,
                max: yMax,
                title: { display: !!yLabel, text: yLabel },
              },
              x: { ticks: { maxTicksLimit: 10 } },
            },
            plugins: { legend: { position: "bottom" } },
          }}
        />
      </div>
    </div>
  );
}
