"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAppStore } from "@/lib/store";
import { TEAMS } from "@/lib/data/teams";
import { getTeam } from "@/lib/data/loader";

const STAGES = [
  { key: "r32", label: "32强" },
  { key: "r16", label: "16强" },
  { key: "qf", label: "8强" },
  { key: "sf", label: "4强" },
  { key: "final", label: "决赛" },
  { key: "champion", label: "夺冠" },
] as const;

export default function StageProgression() {
  const { mcResult } = useAppStore();
  const [teamId, setTeamId] = useState("arg");

  if (!mcResult) return null;
  const prob = mcResult.probabilities.find((p) => p.teamId === teamId);
  if (!prob) return null;
  const team = getTeam(teamId);

  const data = STAGES.map((s) => ({
    stage: s.label,
    prob: +(((prob as any)[s.key] as number) * 100).toFixed(1),
  }));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold">晋级漏斗</h3>
          <p className="text-xs text-muted">各阶段抵达概率</p>
        </div>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm"
        >
          {[...TEAMS]
            .sort((a, b) => b.elo - a.elo)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.flag} {t.name} (Elo {t.elo})
              </option>
            ))}
        </select>
      </div>

      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-2xl">{team?.flag}</span>
        <span className="font-semibold">{team?.name}</span>
        <span className="text-muted text-xs">· FIFA #{team?.fifaRank} · 球风 {styleLabel(team?.style)}</span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="funnelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2b40" />
          <XAxis dataKey="stage" tick={{ fill: "#7e8aa0", fontSize: 11 }} axisLine={{ stroke: "#1f2b40" }} />
          <YAxis tick={{ fill: "#7e8aa0", fontSize: 11 }} axisLine={{ stroke: "#1f2b40" }} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{ background: "#0f1623", border: "1px solid #1f2b40", borderRadius: 8, fontSize: 12 }}
            formatter={(v: any) => [`${v}%`, "概率"]}
          />
          <Area type="monotone" dataKey="prob" stroke="#22c55e" strokeWidth={2} fill="url(#funnelGrad)" />
        </AreaChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-6 gap-1.5 mt-3">
        {data.map((d) => (
          <div key={d.stage} className="text-center">
            <div className="text-[10px] text-muted">{d.stage}</div>
            <div className="text-sm font-bold text-pitch-bright">{d.prob}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function styleLabel(s?: string): string {
  const m: Record<string, string> = {
    possession: "控球",
    counter: "反击",
    press: "高压",
    defensive: "防守",
    balanced: "均衡",
  };
  return m[s ?? ""] ?? s ?? "";
}
