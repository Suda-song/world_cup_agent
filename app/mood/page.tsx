"use client";

import { useState, useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import PageHeader from "@/components/common/PageHeader";
import MoodMeter from "@/components/mood/MoodMeter";
import { TEAMS } from "@/lib/data/teams";
import { getTeam, getPlayersOf } from "@/lib/data/loader";
import {
  teamMoodBreakdown,
  moodScore,
  teamMoodModifier,
  moodEvolutionCurve,
  moodLabel,
} from "@/lib/mood/moodModel";
import { teamStrength } from "@/lib/prediction/elo";

export default function MoodPage() {
  const [teamId, setTeamId] = useState("arg");
  const team = getTeam(teamId)!;

  const breakdown = useMemo(() => teamMoodBreakdown(teamId), [teamId]);
  const score = moodScore(breakdown);
  const mod = teamMoodModifier(teamId);
  const label = moodLabel(score);
  const players = getPlayersOf(teamId);
  const curve = useMemo(() => moodEvolutionCurve(teamId), [teamId]);

  const radarData = [
    { dim: "信心", value: breakdown.confidence },
    { dim: "动机", value: breakdown.motivation },
    { dim: "压力", value: breakdown.pressure },
    { dim: "疲劳", value: breakdown.fatigue },
  ];

  const baseStrength = teamStrength(team, 1);
  const moodedStrength = teamStrength(team, mod);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="球员心情分析"
        subtitle="球员情绪建模（压力/信心/疲劳/动机）及其对球队战力的影响"
        accent="gold"
        right={
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm"
          >
            {[...TEAMS]
              .sort((a, b) => b.elo - a.elo)
              .filter((t) => getPlayersOf(t.id).length > 0)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.flag} {t.name}
                </option>
              ))}
          </select>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* 综合心情 */}
        <div className="card p-5">
          <h3 className="font-bold mb-3">综合心情分</h3>
          <div className="flex flex-col items-center py-4">
            <div
              className="text-5xl font-bold"
              style={{ color: label.color }}
            >
              {score.toFixed(0)}
            </div>
            <div
              className="text-sm font-medium mt-1"
              style={{ color: label.color }}
            >
              {label.label}
            </div>
            <div className="text-[10px] text-muted mt-1">满分 100</div>
          </div>
          <div className="card-2 p-3 mt-2">
            <div className="text-[10px] text-muted">心情修正系数</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-data font-mono">
                ×{mod.toFixed(3)}
              </span>
              <span className="text-[10px] text-muted">
                {mod >= 1 ? "正向加成" : "负面削弱"}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-border text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted">基础战力</span>
                <span className="font-mono">{baseStrength.toFixed(1)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted">心情修正后</span>
                <span
                  className="font-mono font-bold"
                  style={{ color: mod >= 1 ? "#22c55e" : "#ef4444" }}
                >
                  {moodedStrength.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 全队心情雷达 */}
        <div className="card p-5">
          <h3 className="font-bold mb-1">全队心情雷达</h3>
          <p className="text-xs text-muted mb-2">按球员能力加权聚合</p>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="#1f2b40" />
              <PolarAngleAxis dataKey="dim" tick={{ fill: "#e6edf6", fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#3a4a66", fontSize: 9 }} />
              <Radar dataKey="value" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* 心情演化曲线 */}
        <div className="card p-5">
          <h3 className="font-bold mb-1">心情演化曲线</h3>
          <p className="text-xs text-muted mb-2">假设一路晋级到决赛</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={curve} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2b40" />
              <XAxis dataKey="stage" tick={{ fill: "#7e8aa0", fontSize: 10 }} axisLine={{ stroke: "#1f2b40" }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#7e8aa0", fontSize: 10 }} axisLine={{ stroke: "#1f2b40" }} />
              <Tooltip contentStyle={{ background: "#0f1623", border: "1px solid #1f2b40", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="moodScore" name="心情分" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="fatigue" name="疲劳" stroke="#ef4444" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="pressure" name="压力" stroke="#f97316" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 球员卡片 */}
      <div className="card p-5">
        <h3 className="font-bold mb-1">球员心情卡片</h3>
        <p className="text-xs text-muted mb-4">
          {team.flag} {team.name} · {players.length} 名球员 · ★ 为核心球员
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {players
            .sort((a, b) => b.overall - a.overall)
            .map((p) => {
              const ps = moodScore(p.mood);
              const pl = moodLabel(ps);
              return (
                <div
                  key={p.id}
                  className={`card-2 p-4 ${
                    p.isStar ? "ring-1 ring-gold/40" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-1">
                        {p.isStar && <span className="text-gold">★</span>}
                        {p.name}
                      </div>
                      <div className="text-[10px] text-muted">
                        {posLabel(p.position)} · 能力 {p.overall}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-lg font-bold"
                        style={{ color: pl.color }}
                      >
                        {ps.toFixed(0)}
                      </div>
                      <div className="text-[9px]" style={{ color: pl.color }}>
                        {pl.label}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <MoodMeter value={p.mood.confidence} label="信心" size={52} />
                    <MoodMeter value={p.mood.motivation} label="动机" size={52} />
                    <MoodMeter value={p.mood.pressure} label="压力" invert size={52} />
                    <MoodMeter value={p.mood.fatigue} label="疲劳" invert size={52} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function posLabel(p: string): string {
  const m: Record<string, string> = { GK: "门将", DF: "后卫", MF: "中场", FW: "前锋" };
  return m[p] ?? p;
}
