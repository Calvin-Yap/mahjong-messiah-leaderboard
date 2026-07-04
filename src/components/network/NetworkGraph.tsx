'use client';

import { useEffect, useRef } from 'react';
import type { NetworkDataDTO } from '@/lib/types';

interface NetworkGraphProps {
  data: NetworkDataDTO;
  egoPlayer?: string | null; // single-player ego graph mode
  minGamesTogether?: number;
}

// Ports the co-play edge computation from network.html: edge weight =
// number of games two players shared, filtered by `minGamesTogether`.
// Ego mode restricts nodes/edges to one player's direct connections.
export function NetworkGraph({ data, egoPlayer, minGamesTogether = 1 }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Build co-play edge weights.
    const pairCounts = new Map<string, number>();
    data.rows.forEach((row) => {
      const present = data.players.filter((p) => row.scoresByPlayer[p] !== null);
      for (let i = 0; i < present.length; i++) {
        for (let j = i + 1; j < present.length; j++) {
          const key = [present[i], present[j]].sort().join('::');
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    });

    let nodeNames = data.players;
    let edges = Array.from(pairCounts.entries())
      .map(([key, weight]) => {
        const [a, b] = key.split('::');
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
    }

    // TODO(vis-network): dynamic import + instantiate `Network` here, e.g.:
    //   const { Network, DataSet } = await import('vis-network/standalone');
    //   const nodes = new DataSet(nodeNames.map((id) => ({ id, label: id })));
    //   const edgeSet = new DataSet(edges.map((e) => ({ ...e, width: Math.min(e.value, 8) })));
    //   new Network(containerRef.current, { nodes, edges: edgeSet }, { physics: { stabilization: true } });
    // Kept as a comment rather than a hard dependency so this file type-checks
    // without vis-network's SSR quirks — wire up on the client only.
  }, [data, egoPlayer, minGamesTogether]);

  return <div ref={containerRef} className="h-[600px] w-full rounded-card bg-ink-50" />;
}
