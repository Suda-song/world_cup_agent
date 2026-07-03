"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAppStore } from "@/lib/store";
import { getTeam } from "@/lib/data/loader";
import { teamFlag } from "@/components/common/TeamBadge";

export default function ChampionChart() {
  const { mcResult } = useAppStore();
  if (!mcResult) return null;

  const data = mcResult.topChampions.map((c) => ({
    name: `${teamFlag(c.teamId)} ${getTeam(c.teamId)?.name ?? c.teamId}`,
    pct: +(c.pct * 100).toFixed(2),
    id: c.teamId,
  }));

  return (
    <div className="card p-5">
      <h3 className="font-bold mb-1">夺冠概率排行 Top 15</h3>
      <p className="text-xs text-muted mb-4">
        基于 {mcResult.n.toLocaleString()} 次蒙特卡洛模拟
      </p>
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4 }}>
          <XAxis
            type="number"
            tick={{ fill: "#7e8aa0", fontSize: 11 }}
            axisLine={{ stroke: "#1f2b40" }}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: "#e6edf6", fontSize: 11 }}
            axisLine={{ stroke: "#1f2b40" }}
          />
          <Tooltip
            cursor={{ fill: "rgba(56,189,248,0.08)" }}
            contentStyle={{
              background: "#0f1623",
              border: "1px solid #1f2b40",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: any) => [`${v}%`, "夺冠概率"]}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={d.id} fill={i === 0 ? "#fbbf24" : i < 3 ? "#22c55e" : i < 8 ? "#38bdf8" : "#64748b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
