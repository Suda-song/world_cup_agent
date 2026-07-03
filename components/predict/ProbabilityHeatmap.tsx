"use client";

import { useAppStore } from "@/lib/store";
import { getTeam } from "@/lib/data/loader";

const COLS = [
  { key: "r32", label: "32强" },
  { key: "r16", label: "16强" },
  { key: "qf", label: "8强" },
  { key: "sf", label: "4强" },
  { key: "final", label: "决赛" },
  { key: "champion", label: "夺冠" },
] as const;

function heatColor(p: number): string {
  // 0~1 映射到深->亮的绿色
  if (p <= 0) return "#0f1623";
  const a = Math.min(1, p * 1.6);
  if (p > 0.2) return `rgba(251, 191, 36, ${a})`; // 金色高概率
  if (p > 0.05) return `rgba(34, 197, 94, ${a})`; // 绿色
  return `rgba(56, 189, 248, ${a * 0.8})`; // 蓝色低概率
}

export default function ProbabilityHeatmap() {
  const { mcResult } = useAppStore();
  if (!mcResult) return null;

  const sorted = [...mcResult.probabilities].sort(
    (a, b) => b.champion - a.champion
  );

  return (
    <div className="card p-5">
      <h3 className="font-bold mb-1">全队晋级概率图谱</h3>
      <p className="text-xs text-muted mb-4">
        48 支球队 × 6 阶段抵达概率热力图（按夺冠概率排序）
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted">
              <th className="text-left font-medium pb-2 pr-3 sticky left-0 bg-surface">#</th>
              <th className="text-left font-medium pb-2 pr-3 sticky left-8 bg-surface min-w-[110px]">球队</th>
              {COLS.map((c) => (
                <th key={c.key} className="font-medium pb-2 px-1 text-center min-w-[58px]">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.teamId} className="border-t border-border/40">
                <td className="py-1 pr-3 text-muted">{i + 1}</td>
                <td className="py-1 pr-3">
                  <HeatRow teamId={p.teamId} />
                </td>
                {COLS.map((c) => {
                  const val = (p as any)[c.key] as number;
                  return (
                    <td key={c.key} className="py-1 px-1 text-center">
                      <div
                        className="rounded-md py-1.5 font-mono font-semibold"
                        style={{
                          background: heatColor(val),
                          color: val > 0.05 ? "#070b14" : "#7e8aa0",
                        }}
                        title={`${(val * 100).toFixed(1)}%`}
                      >
                        {(val * 100).toFixed(0)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeatRow({ teamId }: { teamId: string }) {
  const team = getTeam(teamId);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{team?.flag}</span>
      <span className="font-medium">{team?.name}</span>
      <span className="text-[10px] text-muted">{team?.group}组</span>
    </span>
  );
}
