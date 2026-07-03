"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { getTeam } from "@/lib/data/loader";

const AXES = [
  { key: "attack", label: "进攻" },
  { key: "defense", label: "防守" },
  { key: "midfield", label: "中场" },
  { key: "speed", label: "速度" },
  { key: "experience", label: "经验" },
  { key: "form", label: "状态" },
] as const;

export default function MatchupRadar({
  aId,
  bId,
}: {
  aId: string;
  bId: string;
}) {
  const a = getTeam(aId);
  const b = getTeam(bId);
  if (!a || !b) return null;

  const data = AXES.map((ax) => ({
    dim: ax.label,
    [a.name]: (a.ratings as any)[ax.key],
    [b.name]: (b.ratings as any)[ax.key],
  }));

  return (
    <div className="card p-5">
      <h3 className="font-bold mb-1">六维能力对比</h3>
      <p className="text-xs text-muted mb-2">攻防/中场/速度/经验/状态雷达图</p>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#1f2b40" />
          <PolarAngleAxis dataKey="dim" tick={{ fill: "#e6edf6", fontSize: 11 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#3a4a66", fontSize: 9 }} />
          <Tooltip
            contentStyle={{ background: "#0f1623", border: "1px solid #1f2b40", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Radar name={a.name} dataKey={a.name} stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
          <Radar name={b.name} dataKey={b.name} stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
