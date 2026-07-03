"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { getTeam, getHistory } from "@/lib/data/loader";
import StageTimeline from "@/components/common/StageTimeline";
import { currentFocusStage, formatDate } from "@/lib/schedule";

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
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <div className="card p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 text-[180px] opacity-5 select-none">🏆</div>
        <div className="relative">
          <div className="flex items-center gap-2 text-xs text-muted mb-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full bg-pitch/15 text-pitch-bright">2026 美加墨世界杯</span>
            <span>48 队 · 12 组 · 新赛制</span>
            <span className="px-2 py-0.5 rounded-full bg-warn/15 text-warn">
              当前：{currentFocusStage().stage.labelFull}（{formatDate(currentFocusStage().stage.start)}–{formatDate(currentFocusStage().stage.end)}）· 已进入淘汰赛
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            <span className="shimmer-text">世界杯冠军预测系统</span>
          </h1>
          <p className="text-sm text-muted mt-2 max-w-2xl">
            基于 Elo 评分 + 泊松进球模型 + 蒙特卡洛模拟，整合完整赛程对阵、多维度图关系、战术对抗设计与球员心情分析，搭载 Qwen AI 赛事分析，预测各队从小组赛到夺冠的概率与比分。
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Link href="/bracket" className="px-4 py-2 rounded-lg bg-linear-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:brightness-110 transition">
              查看赛程对阵图 →
            </Link>
            <Link href="/predict" className="px-4 py-2 rounded-lg bg-surface-2 border border-border text-sm font-medium hover:bg-surface transition">
              晋级预测
            </Link>
            <span className="text-[11px] text-muted">
              {running ? "正在跑蒙特卡洛模拟…" : mcResult ? `已模拟 ${mcResult.n.toLocaleString()} 次` : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <StageTimeline />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">夺冠概率 Top 10</h3>
            <Link href="/predict" className="text-[11px] text-data">查看完整 →</Link>
          </div>
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
              {running ? "模拟中…" : "等待模拟"}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <MetricCard title="最大冷门候选" value={upset ? `${getTeam(upset.teamId)?.flag} ${getTeam(upset.teamId)?.name}` : "—"} sub={upset ? `FIFA #${getTeam(upset.teamId)?.fifaRank} · ${(upset.pct * 100).toFixed(1)}% 夺冠` : ""} color="text-warn" icon="💣" />
          <MetricCard title="最稳黑马" value={darkHorse ? `${getTeam(darkHorse.teamId)?.flag} ${getTeam(darkHorse.teamId)?.name}` : "—"} sub={darkHorse ? `FIFA #${getTeam(darkHorse.teamId)?.fifaRank} · ${(darkHorse.pct * 100).toFixed(1)}% 夺冠` : ""} color="text-pitch-bright" icon="🐴" />
          {rivalry && (
            <MetricCard title="经典对抗" value={`${getTeam(rivalry.teamA)?.flag} vs ${getTeam(rivalry.teamB)?.flag}`} sub={`${rivalry.played} 次交锋`} color="text-data" icon="⚔️" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <ModuleCard href="/bracket" icon="🏆" title="赛程对阵图" desc="完整赛果预测含比分与推理链路" color="from-amber-500/20 to-transparent border-amber-500/30" />
        <ModuleCard href="/predict" icon="📊" title="各阶段晋级预测" desc="蒙特卡洛模拟 48 队 6 阶段抵达概率" color="from-pitch/20 to-transparent border-pitch/30" />
        <ModuleCard href="/relationships" icon="🕸" title="多维度图关系" desc="实力/攻防/风格/历史关系网络图谱" color="from-data/20 to-transparent border-data/30" />
        <ModuleCard href="/matchup" icon="⚔️" title="竞争对抗设计" desc="两两对战泊松预测与战术克制分析" color="from-warn/20 to-transparent border-warn/30" />
        <ModuleCard href="/mood" icon="🧠" title="球员心情分析" desc="情绪建模与对球队战力的影响" color="from-gold/20 to-transparent border-gold/30" />
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, color, icon }: { title: string; value: string; sub: string; color: string; icon: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center text-lg">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] text-muted uppercase tracking-wider">{title}</div>
        <div className={`text-base font-bold ${color} truncate`}>{value}</div>
        <div className="text-[10px] text-muted truncate">{sub}</div>
      </div>
    </div>
  );
}

function ModuleCard({ href, icon, title, desc, color }: { href: string; icon: string; title: string; desc: string; color: string }) {
  return (
    <Link href={href} className={`card p-5 bg-linear-to-br ${color} hover:scale-[1.02] transition-transform`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-bold text-sm">{title}</div>
      <div className="text-[11px] text-muted mt-1">{desc}</div>
      <div className="text-[11px] text-data mt-3">进入 →</div>
    </Link>
  );
}

function pickRivalry() {
  const sorted = [...getHistory()].sort((a, b) => b.played - a.played);
  return sorted[0];
}
