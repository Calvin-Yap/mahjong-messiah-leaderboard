'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartData,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// Distinct, high-contrast palette — ported from the color set used in the
// original dashboard.html so returning users see familiar player colors.
export const PLAYER_COLORS = [
  '#e53e3e', '#3182ce', '#68d391', '#d53f8c', '#38b2ac', '#dd6b20',
  '#4299e1', '#d69e2e', '#276749', '#805ad5', '#38a169', '#c53030',
];

interface LineChartPanelProps {
  title: string;
  subtitle: string;
  labels: string[];
  series: { name: string; data: (number | null)[] }[];
  yLabel?: string;
  reverseYAxis?: boolean; // for the "rank over time" bump chart (1 = best, at top)
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
}: LineChartPanelProps) {
  const data: ChartData<'line'> = {
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
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { reverse: reverseYAxis, title: { display: !!yLabel, text: yLabel } },
            x: { ticks: { maxTicksLimit: 10 } },
          },
          plugins: { legend: { position: 'bottom' } },
        }}
        height={280}
      />
    </div>
  );
}
