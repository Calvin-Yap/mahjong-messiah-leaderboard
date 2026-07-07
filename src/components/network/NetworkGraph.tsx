"use client";

import { useEffect, useRef } from "react";
import type { NetworkDataDTO } from "@/lib/types";

interface NetworkGraphProps {
  data: NetworkDataDTO;
  egoPlayer?: string | null; // single-player ego graph mode
  minGamesTogether?: number;
}

// Ports the co-play edge computation from network.html: edge weight =
// number of games two players shared, filtered by `minGamesTogether`.
// Ego mode restricts nodes/edges to one player's direct connections.
export function NetworkGraph({
  data,
  egoPlayer,
  minGamesTogether = 1,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let network: any;

    // Build co-play edge weights from every game both players appear in.
    const pairCounts = new Map<string, number>();
    data.rows.forEach((row) => {
      const present = data.players.filter(
        (p) =>
          row.scoresByPlayer[p] !== null && row.scoresByPlayer[p] !== undefined,
      );
      for (let i = 0; i < present.length; i++) {
        for (let j = i + 1; j < present.length; j++) {
          const key = [present[i], present[j]].sort().join("::");
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    });

    let nodeNames = data.players;
    let edges = Array.from(pairCounts.entries())
      .map(([key, weight]) => {
        const [a, b] = key.split("::");
        return { from: a!, to: b!, value: weight };
      })
      .filter((e) => e.value >= minGamesTogether);

    if (egoPlayer) {
      edges = edges.filter((e) => e.from === egoPlayer || e.to === egoPlayer);
      const connected = new Set<string>([egoPlayer]);
      edges.forEach((e) => {
        connected.add(e.from);
        connected.add(e.to);
      });
      nodeNames = nodeNames.filter((n) => connected.has(n));
    } else {
      // Trim isolated nodes (no edges meeting the threshold) so the graph
      // doesn't scatter unconnected dots around the canvas.
      const connected = new Set<string>();
      edges.forEach((e) => {
        connected.add(e.from);
        connected.add(e.to);
      });
      nodeNames = nodeNames.filter((n) => connected.has(n));
    }

    async function render() {
      // vis-network doesn't play well with SSR — dynamic-imported client-only.
      const { Network, DataSet } = await import("vis-network/standalone");
      if (cancelled || !containerRef.current) return;

      const nodes = new DataSet(
        nodeNames.map((id) => ({
          id,
          label: id === egoPlayer ? `⭐ ${id}` : id,
        })),
      );
      const edgeSet = new DataSet(
        edges.map((e, i) => ({
          id: i,
          from: e.from,
          to: e.to,
          value: e.value,
          title: `${e.value} game${e.value === 1 ? "" : "s"} together`,
        })),
      );

      network = new Network(
        containerRef.current,
        { nodes, edges: edgeSet },
        {
          nodes: {
            shape: "dot",
            size: 18,
            font: { color: "#2d3748", size: 14 },
            color: {
              background: "#667eea",
              border: "#5568d3",
              highlight: { background: "#764ba2" },
            },
          },
          edges: {
            color: { color: "#cbd5e0", highlight: "#667eea" },
            smooth: false,
            scaling: { min: 1, max: 8 },
          },
          physics: {
            stabilization: true,
            barnesHut: { gravitationalConstant: -4000, springLength: 120 },
          },
          interaction: { hover: true, tooltipDelay: 100 },
        },
      );
    }
    render();

    return () => {
      cancelled = true;
      network?.destroy();
    };
  }, [data, egoPlayer, minGamesTogether]);

  const hasAnyData = data.players.length > 0 && data.rows.length > 0;
  if (!hasAnyData) {
    return (
      <div className="flex h-[600px] w-full items-center justify-center rounded-card bg-ink-50 text-ink-400">
        No games recorded yet.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[600px] w-full rounded-card bg-ink-50"
    />
  );
}
