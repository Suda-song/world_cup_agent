"use client";

import { useMemo } from "react";
import { GraphCanvas, type GraphNode, type GraphEdge, darkTheme } from "reagraph";
import { TEAMS } from "@/lib/data/teams";
import { getTeam } from "@/lib/data/loader";
import { predictMatchup } from "@/lib/prediction/poisson";
import { computeMoodMods } from "@/lib/store";

export default function CounterNetwork({ aId }: { aId: string }) {
  const { nodes, edges } = useMemo(() => {
    const a = getTeam(aId);
    if (!a) return { nodes: [], edges: [] };
    const moodMods = computeMoodMods();
    const gNodes: GraphNode[] = [
      {
        id: a.id,
        label: `${a.flag} ${a.name}`,
        fill: "#fbbf24",
        size: 22,
      },
    ];
    const gEdges: GraphEdge[] = [];
    for (const t of TEAMS) {
      if (t.id === a.id) continue;
      const pred = predictMatchup(a, t, moodMods);
      const adv = pred.winA - pred.winB; // >0 A占优
      gNodes.push({
        id: t.id,
        label: `${t.flag} ${t.name}`,
        fill: adv > 0.1 ? "#22c55e" : adv < -0.1 ? "#ef4444" : "#64748b",
        size: 7 + Math.abs(adv) * 14,
      });
      gEdges.push({
        id: `${a.id}-${t.id}`,
        source: a.id,
        target: t.id,
        label: `${(pred.winA * 100).toFixed(0)}%`,
        fill: adv > 0.1 ? "#22c55e" : adv < -0.1 ? "#ef4444" : "#3a4a66",
        size: 0.5 + Math.abs(adv) * 3,
      });
    }
    return { nodes: gNodes, edges: gEdges };
  }, [aId]);

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-bold">克制图谱</h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-pitch-bright" /> 克制
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-danger" /> 被克制
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-500" /> 势均力敌
          </span>
        </div>
      </div>
      <div style={{ height: 460, background: "#070b14" }}>
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          theme={darkTheme}
          layoutType="radialOut2d"
          labelType="auto"
        />
      </div>
    </div>
  );
}
