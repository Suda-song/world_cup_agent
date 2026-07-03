"use client";

import { useMemo, useState } from "react";
import { GraphCanvas, type GraphNode, type GraphEdge, darkTheme } from "reagraph";
import {
  computeEdges,
  graphNodes,
  DIMENSIONS,
  type Dimension,
} from "@/lib/graphs/relations";
import { TEAMS } from "@/lib/data/teams";
import { getTeam } from "@/lib/data/loader";

const CONF_COLOR: Record<string, string> = {
  UEFA: "#38bdf8",
  CONMEBOL: "#22c55e",
  CONCACAF: "#fbbf24",
  CAF: "#f97316",
  AFC: "#a78bfa",
  OFC: "#f472b6",
};

export default function TeamNetwork({ dims }: { dims: Dimension[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const rawNodes = graphNodes();
    const minElo = Math.min(...TEAMS.map((t) => t.elo));
    const maxElo = Math.max(...TEAMS.map((t) => t.elo));
    const gNodes: GraphNode[] = rawNodes.map((n) => {
      const team = getTeam(n.id)!;
      const size = 6 + ((team.elo - minElo) / (maxElo - minElo)) * 16;
      return {
        id: n.id,
        label: `${team.flag} ${team.name}`,
        fill: CONF_COLOR[team.confederation] ?? "#64748b",
        size,
        cluster: team.confederation,
        data: n.data,
      };
    });
    const rawEdges = computeEdges(dims);
    const gEdges: GraphEdge[] = rawEdges.map((e) => {
      const dim = DIMENSIONS.find((d) => d.key === e.dimension)!;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        fill: dim.color,
        size: 0.5 + e.weight * 2.5,
      };
    });
    return { nodes: gNodes, edges: gEdges };
  }, [dims]);

  const team = selected ? getTeam(selected) : null;

  return (
    <div className="card p-0 overflow-hidden relative">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <h3 className="font-bold">球队关系网络图</h3>
        <div className="flex items-center gap-3 text-[10px]">
          {Object.entries(CONF_COLOR).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: c }} />
              {k}
            </span>
          ))}
        </div>
      </div>
      <div style={{ height: 560, background: "#070b14" }}>
        {edges.length > 0 ? (
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            theme={darkTheme}
            layoutType="forceDirected2d"
            labelType="auto"
            onNodeClick={(n) => setSelected(n.id)}
            cameraMode="pan"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted text-sm">
            请至少选择一个关系维度
          </div>
        )}
      </div>
      {team && (
        <div className="absolute bottom-4 left-4 card-2 p-3 max-w-[220px] pointer-events-none">
          <div className="text-lg font-bold">
            {team.flag} {team.name}
          </div>
          <div className="text-[11px] text-muted mt-1">
            Elo {team.elo} · FIFA #{team.fifaRank}
          </div>
          <div className="text-[11px] text-muted">
            {team.confederation} · {team.group}组
          </div>
          <button
            className="mt-2 text-[10px] text-data pointer-events-auto"
            onClick={() => setSelected(null)}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
