"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { getTeam, getHistory } from "@/lib/data/loader";
import StageTimeline from "@/components/common/StageTimeline";
import PageHeader from "@/components/common/PageHeader";
import SimulationPanel from "@/components/predict/SimulationPanel";
import StageProgression from "@/components/predict/StageProgression";
import ProbabilityHeatmap from "@/components/predict/ProbabilityHeatmap";

export default function DashboardPage() {
  const { mcResult, running, runSimulation, loadViewpoints, agentInitialized } = useAppStore();

  useEffect(() => {
    // Agent 已跑过预测则直接使用其结果，不重复模拟
    if (!mcResult && !running && !agentInitialized) {
      loadViewpoints().finally(() => runSimulation(3000));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top10 = mcResult?.topChampions.slice(0, 10) ?? [];
  const maxPct = top10[0]?.pct ?? 1;

  const upset = mcResult
    ? [...mcResult.topChampions]
        .filter((c) => c.pct > 0.005)
        .sort((a, b) => (getTeam(b.teamId)?.fifaRank ?? 99) - (getTeam(a.teamId)?.fifaRank ?? 99))[0]
    : null;
  const darkHorse = mcResult
    ? [...mcResult.topChampions]
        .filter((c) => (getTeam(c.teamId)?.fifaRank ?? 99) > 10)
        .sort((a, b) => b.pct - a.pct)[0]
    : null;
  const rivalry = pickRivalry();

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="夺冠 · 晋级概率"
        subtitle="本页回答：谁最可能夺冠？每支球队能走多远？ —— 蒙特卡洛模拟（后端运行）"
        accent="pitch"
      />

      <StageTimeline />

      {/* 模拟引擎控制（重新模拟在后端跑） */}
      <SimulationPanel />

      {/* 夺冠概率 Top10 + 关键指标 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-bold mb-4">夺冠概率 Top 10</h3>
          {top10.length > 0 ? (
            <div className="space-y-2">
              {top10.map((c, i) => {
                const t = getTeam(c.teamId);
                return (
                  <div key={c.teamId} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-muted font-mono text-right">{i + 1}</span>
                    <span className="w-28 text-sm flex items-center gap-1.5 shrink-0">
                      <span className="text-base">{t?.flag}</span>
                      <span className="truncate">{t?.name}</span>
                    </span>
                    <div className="flex-1 h-6 rounded-md bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-md flex items-center justify-end px-2 animate-bar"
                        style={{
                          width: `${(c.pct / maxPct) * 100}%`,
                          background:
                            i === 0 ? "linear-gradient(90deg,#fbbf24,#f97316)" : i < 3 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#38bdf8,#0ea5e9)",
                        }}
                      >
                        <span className="text-[10px] font-mono font-bold text-[#070b14]">
                          {(c.pct * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted text-sm">
              {running ? "后端模拟中…" : "等待模拟"}
            </div>
          )}
        </div>

        <div className="space-y-5">
          {/* 最大冷门 — 闪电 */}
          <MetricCard title="最大冷门候选" value={upset ? `${getTeam(upset.teamId)?.flag} ${getTeam(upset.teamId)?.name}` : "—"} sub={upset ? `FIFA #${getTeam(upset.teamId)?.fifaRank} · ${(upset.pct * 100).toFixed(1)}% 夺冠` : ""} color="text-warn" icon="M13 2L3 14h8l-2 8 12-14h-8z" />
          {/* 最稳黑马 — 上升 */}
          <MetricCard title="最稳黑马" value={darkHorse ? `${getTeam(darkHorse.teamId)?.flag} ${getTeam(darkHorse.teamId)?.name}` : "—"} sub={darkHorse ? `FIFA #${getTeam(darkHorse.teamId)?.fifaRank} · ${(darkHorse.pct * 100).toFixed(1)}% 夺冠` : ""} color="text-pitch-bright" icon="M3 17l6-6 4 4 8-8M21 7v6h-6" />
          {rivalry && (
            /* 经典对抗 — 交叉 */
            <MetricCard title="经典对抗" value={`${getTeam(rivalry.teamA)?.flag} vs ${getTeam(rivalry.teamB)?.flag}`} sub={`${rivalry.played} 次交锋`} color="text-data" icon="M5 5l14 14M19 5L5 19" />
          )}
        </div>
      </div>

      {/* 各阶段晋级漏斗 + 全队热力图 */}
      {mcResult && (
        <>
          <StageProgression />
          <ProbabilityHeatmap />
        </>
      )}
    </div>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function MetricCard({ title, value, sub, color, icon }: { title: string; value: string; sub: string; color: string; icon: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${color}`}>
        <Icon path={icon} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-muted uppercase tracking-wider">{title}</div>
        <div className={`text-base font-bold ${color} truncate`}>{value}</div>
        <div className="text-[10px] text-muted truncate">{sub}</div>
      </div>
    </div>
  );
}

function pickRivalry() {
  const sorted = [...getHistory()].sort((a, b) => b.played - a.played);
  return sorted[0];
}
