"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import PageHeader from "@/components/common/PageHeader";
import {
  DIMENSIONS,
  graphStats,
  type Dimension,
} from "@/lib/graphs/relations";
import { getTeam } from "@/lib/data/loader";

// reagraph 基于 WebGL，需客户端渲染
const TeamNetwork = dynamic(() => import("@/components/graphs/TeamNetwork"), {
  ssr: false,
  loading: () => (
    <div className="card h-[600px] flex items-center justify-center text-muted">
      加载网络图引擎…
    </div>
  ),
});

export default function RelationshipsPage() {
  const [dims, setDims] = useState<Dimension[]>([
    "strength",
    "style",
    "history",
  ]);

  const toggle = (d: Dimension) =>
    setDims((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );

  const stats = useMemo(() => graphStats(dims), [dims]);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="多维度图关系"
        subtitle="球队间实力/攻防/风格/历史/同组/同洲关系网络图谱"
        accent="data"
      />

      {/* 维度控制 */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted mr-1">关系维度：</span>
          {DIMENSIONS.map((d) => {
            const on = dims.includes(d.key);
            return (
              <button
                key={d.key}
                onClick={() => toggle(d.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  on
                    ? "border-transparent text-[#070b14]"
                    : "border-border text-muted hover:text-foreground"
                }`}
                style={on ? { background: d.color } : {}}
              >
                {d.label}
              </button>
            );
          })}
          <span className="text-[11px] text-muted ml-auto">
            共 {stats.totalEdges} 条关系边
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <TeamNetwork dims={dims} />
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-bold text-sm mb-3">最强关系对</h3>
            <div className="space-y-2">
              {stats.strongest.map((e) => (
                <RelationRow key={e.id} e={e} />
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-sm mb-3">最克制关系（攻防互补）</h3>
            <div className="space-y-2">
              {stats.counterEdges.length > 0 ? (
                stats.counterEdges.map((e) => <RelationRow key={e.id} e={e} />)
              ) : (
                <div className="text-xs text-muted">未选择「攻防互补」维度</div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-sm mb-3">孤立球队</h3>
            {stats.isolated.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {stats.isolated.map((n) => (
                  <span
                    key={n}
                    className="text-[11px] px-2 py-1 rounded bg-surface-2 text-muted"
                  >
                    {n}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted">无孤立球队</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RelationRow({
  e,
}: {
  e: { source: string; target: string; label: string; weight: number; dimension: Dimension };
}) {
  const a = getTeam(e.source);
  const b = getTeam(e.target);
  const dim = DIMENSIONS.find((d) => d.key === e.dimension)!;
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dim.color }} />
        {a?.flag} {a?.name}
        <span className="text-muted">↔</span>
        {b?.flag} {b?.name}
      </span>
      <span className="text-muted text-[10px]">{e.label}</span>
    </div>
  );
}
