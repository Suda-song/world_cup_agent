"use client";

import { useState, useEffect } from "react";
import {
  simulateDetailedTournament,
  type DetailedSimResult,
  type MatchReasoning as MatchReason,
  type KnownMatchResult,
} from "@/lib/prediction/detailedSim";
import type { TournamentStatus } from "@/app/api/live-results/route";
import { computeMoodMods, useAppStore } from "@/lib/store";
import MatchReasoningPanel from "@/components/bracket/MatchReasoning";
import { getTeam } from "@/lib/data/loader";
import { TEAMS } from "@/lib/data/teams";
import StageTimeline from "@/components/common/StageTimeline";
import { apiUrl } from "@/lib/basePath";

const STAGE_LABEL: Record<string, string> = {
  group: "小组赛",
  r32: "32强",
  r16: "16强",
  qf: "1/4决赛",
  sf: "半决赛",
  final: "决赛",
};

const STAGES = ["r32", "r16", "qf", "sf", "final"] as const;

function flag(id: string): string {
  const t = getTeam(id);
  return t?.flag || "🏳️";
}

function name(id: string): string {
  const t = getTeam(id);
  return t?.name || id;
}

export default function BracketPage() {
  const [useMood, setUseMood] = useState(true);
  const [simKey, setSimKey] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState<MatchReason | null>(null);
  const [result, setResult] = useState<DetailedSimResult | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [tournamentStatus, setTournamentStatus] =
    useState<TournamentStatus | null>(null);
  const viewpointMods = useAppStore((s) => s.viewpointMods);

  useEffect(() => {
    let cancelled = false;
    const moodMods = useMood ? computeMoodMods() : {};
    const mods: Record<string, number> = {};
    for (const t of TEAMS) {
      mods[t.id] = (moodMods[t.id] ?? 1) * (viewpointMods[t.id] ?? 1);
    }

    fetch(apiUrl("/api/live-results"))
      .then((r) => r.json())
      .then(
        (data: {
          available: boolean;
          matches?: KnownMatchResult[];
          groupMatches?: KnownMatchResult[];
          tournamentStatus?: TournamentStatus;
          error?: string;
        }) => {
          if (cancelled) return;
          const knockoutMatches: KnownMatchResult[] = data.available ? (data.matches ?? []) : [];
          const groupMatches: KnownMatchResult[] = data.available ? (data.groupMatches ?? []) : [];
          if (!data.available && data.error) setLiveError(data.error);
          else setLiveError(null);
          if (data.tournamentStatus) setTournamentStatus(data.tournamentStatus);
          setResult(simulateDetailedTournament(mods, knockoutMatches, groupMatches));
          setSelectedMatch(null);
        },
      )
      .catch(() => {
        if (cancelled) return;
        setResult(simulateDetailedTournament(mods, [], []));
        setSelectedMatch(null);
      });

    return () => {
      cancelled = true;
    };
  }, [useMood, simKey, viewpointMods]);

  if (!result) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted text-sm">正在模拟赛程...</div>
      </div>
    );
  }

  const championTeam = getTeam(result.champion);
  const runnerUpTeam = getTeam(result.runnerUp);

  const matchesByStage = (stage: string) => {
    return result.knockout.filter((m) => m.stage === stage);
  };

  const isChampionMatch = (m: MatchReason) =>
    m.teamA === result.champion || m.teamB === result.champion;

  const handleMatchClick = (m: MatchReason) => {
    setSelectedMatch(m);
  };

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">赛程对阵图</h1>
          <p className="text-sm text-muted mt-1">
            完整赛果预测：小组赛 → 32强 → 16强 → 1/4决赛 → 半决赛 → 决赛 ·
            含比分预测与推理链路
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={useMood}
              onChange={(e) => setUseMood(e.target.checked)}
              className="accent-pitch-bright"
            />
            球员心情
          </label>
          <button
            onClick={() => {
              setSimKey((k) => k + 1);
              setSelectedMatch(null);
            }}
            className="px-4 py-2 rounded-xl bg-pitch text-black font-medium text-sm hover:bg-pitch-bright transition-colors"
          >
            重新模拟
          </button>
        </div>
      </div>

      {/* 赛事当前进度 */}
      {tournamentStatus && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">赛程进度：</span>
          {(["r32", "r16", "qf", "sf", "final"] as const).map((s) => {
            const isCompleted = tournamentStatus.completedStages.includes(s);
            const isCurrent = tournamentStatus.currentStage === s;
            const isUpcoming = tournamentStatus.upcomingStages.includes(s);
            return (
              <span
                key={s}
                className={`px-2 py-0.5 rounded-full font-medium ${
                  isCompleted
                    ? "bg-pitch/20 text-pitch-bright"
                    : isCurrent
                      ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
                      : "bg-surface-2 text-muted"
                }`}
              >
                {isCompleted ? "✓ " : isCurrent ? "▶ " : ""}
                {STAGE_LABEL[s]}
              </span>
            );
          })}
        </div>
      )}

      {/* 真实数据状态提示 */}
      {liveError && (
        <div className="text-xs text-warn/80 bg-warn/10 border border-warn/20 rounded-lg px-3 py-2">
          ⚠️ 实时比赛结果获取失败（{liveError}），已退回模型预测模式
        </div>
      )}

      {/* 赛程时间轴（当前阶段高亮） */}
      <StageTimeline />

      {/* 冠军展示 */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-pitch/10 to-transparent border border-amber-500/20 p-5 flex items-center gap-5">
        <div className="text-5xl">🏆</div>
        <div className="flex-1">
          <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
            预测冠军
          </div>
          <div className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">{championTeam?.flag}</span>
            {championTeam?.name}
          </div>
          <div className="text-xs text-muted mt-0.5">
            亚军：{runnerUpTeam?.flag} {runnerUpTeam?.name}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">淘汰赛场次</div>
          <div className="text-xl font-bold text-pitch-bright">
            {result.knockout.length}
          </div>
          <div className="text-xs text-muted">
            场（含点球 {result.knockout.filter((m) => m.wentToPenalties).length}{" "}
            场）
          </div>
        </div>
      </div>

      {/* 小组赛 */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-pitch-bright" />
          小组赛阶段
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {result.groupStage.map((grp) => (
            <div
              key={grp.group}
              className={`rounded-xl border overflow-hidden ${grp.isReal ? "border-pitch/30 bg-pitch/3" : "border-border bg-surface/60"}`}
            >
              <div className={`px-3 py-1.5 text-xs font-bold border-b flex items-center justify-between ${grp.isReal ? "bg-pitch/10 border-pitch/20" : "bg-surface-2 border-border"}`}>
                <span>{grp.group} 组</span>
                <span className={`text-[9px] px-1 rounded font-normal ${grp.isReal ? "text-pitch-bright" : "text-muted"}`}>
                  {grp.isReal ? "✓ 真实" : "~ 预测"}
                </span>
              </div>
              <div className="p-1.5 space-y-0.5">
                {grp.standings.map((row, idx) => (
                  <div
                    key={row.team.id}
                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-xs ${
                      idx === 0
                        ? "bg-pitch/10"
                        : idx === 1
                          ? "bg-data/5"
                          : idx === 2
                            ? "bg-amber-500/5"
                            : "opacity-50"
                    }`}
                  >
                    <span className="text-sm">{row.team.flag}</span>
                    <span className="flex-1 truncate font-medium">
                      {row.team.name}
                    </span>
                    <span className="text-muted text-[10px]">
                      {row.pts}分 {row.gf}:{row.ga}
                    </span>
                    {idx === 0 && (
                      <span className="text-[9px] text-pitch-bright">1st</span>
                    )}
                    {idx === 1 && (
                      <span className="text-[9px] text-data">2nd</span>
                    )}
                    {idx === 2 && (
                      <span className="text-[9px] text-amber-400">3rd</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-pitch/30" />
            小组头名
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-data/20" />
            小组次名
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-amber-500/20" />
            第三名（前8晋级）
          </span>
        </div>
      </div>

      {/* 淘汰赛对阵图 */}
      <div>
        {/* 对阵图 */}
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-pitch-bright" />
            淘汰赛对阵图
          </h2>
          <div className="overflow-x-auto pb-3">
            <div className="flex gap-3 min-w-max items-stretch">
              {STAGES.map((stage) => {
                const matches = matchesByStage(stage);
                return (
                  <div key={stage} className="flex flex-col" style={{ minWidth: 200 }}>
                    <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2 text-center">
                      {STAGE_LABEL[stage]}
                    </div>
                    <div className="flex flex-col gap-2">
                      {matches.map((m) => {
                        const isChamp = isChampionMatch(m);
                        const isSelected = selectedMatch?.matchId === m.matchId;
                        const ms = m.matchState;
                        const cardClass = isSelected
                          ? "border-pitch-bright bg-pitch/10 glow-pitch"
                          : ms === "finished"
                            ? "border-pitch/40 bg-pitch/5 hover:border-pitch/60"
                            : ms === "confirmed"
                              ? "border-violet-400/50 bg-violet-400/8 hover:border-violet-400/70"
                              : "border-zinc-600/40 bg-zinc-800/30 hover:border-zinc-500/50";
                        const tagClass = ms === "finished"
                          ? "bg-pitch/25 text-pitch-bright"
                          : ms === "confirmed"
                            ? "bg-violet-500/20 text-violet-300"
                            : "bg-zinc-700/50 text-zinc-400";
                        const tagText = ms === "finished"
                          ? "✓ 真实结果"
                          : ms === "confirmed"
                            ? "📅 待踢（对手已定）"
                            : "🔮 预测（对手待定）";
                        return (
                          <div
                            key={m.matchId}
                            onClick={() => handleMatchClick(m)}
                            className={`rounded-xl border p-2.5 cursor-pointer transition-all ${cardClass}`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${tagClass}`}>
                                {tagText}
                              </span>
                              {isChamp && !isSelected && (
                                <span className="text-[9px] text-amber-400">★ 冠军之路</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-base">{flag(m.teamA)}</span>
                              <span className={`flex-1 truncate ${m.winner === m.teamA ? "font-bold text-foreground" : "text-muted"}`}>
                                {name(m.teamA)}
                              </span>
                              <span className={`font-mono font-bold text-sm ${m.winner === m.teamA ? (ms === "finished" ? "text-pitch-bright" : "text-orange-600") : "text-muted"}`}>
                                {m.scoreA}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs mt-1">
                              <span className="text-base">{flag(m.teamB)}</span>
                              <span className={`flex-1 truncate ${m.winner === m.teamB ? "font-bold text-foreground" : "text-muted"}`}>
                                {name(m.teamB)}
                              </span>
                              <span className={`font-mono font-bold text-sm ${m.winner === m.teamB ? (ms === "finished" ? "text-pitch-bright" : "text-orange-600") : "text-muted"}`}>
                                {m.scoreB}
                              </span>
                            </div>
                            {m.wentToPenalties && (
                              <div className="text-[9px] text-amber-400 mt-1 text-center">点球大战</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] text-muted mt-2">
            💡 点击任意比赛查看完整推理链路与 AI 赛事分析
          </p>
        </div>

      </div>

      {/* 推理面板 —— 固定浮动在右下角，选中比赛后出现 */}
      {selectedMatch && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-h-[80vh] overflow-y-auto shadow-2xl rounded-2xl">
          <div className="relative">
            <button
              onClick={() => setSelectedMatch(null)}
              className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-surface-2 hover:bg-surface flex items-center justify-center text-muted hover:text-foreground text-xs transition-colors"
            >
              ✕
            </button>
            <MatchReasoningPanel
              match={selectedMatch}
              championId={result.champion}
            />
          </div>
        </div>
      )}

      {/* 冠军之路 */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-amber-400" />
          冠军晋级之路
        </h2>
        <div className="flex items-center overflow-x-auto pb-2">
          {result.championPath.map((m, idx) => (
            <div key={m.matchId} className="flex items-center shrink-0">
              {/* 比赛卡片 */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 min-w-[140px]">
                <div className="text-[10px] text-amber-400 font-semibold mb-1 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${m.isReal ? "bg-pitch-bright" : "bg-amber-400"}`} />
                  {STAGE_LABEL[m.stage]}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span>{flag(m.teamA)}</span>
                  <span className={m.winner === m.teamA ? "font-bold" : "text-muted"}>
                    {name(m.teamA)}
                  </span>
                  <span className={`font-mono font-bold ${m.winner === m.teamA ? (m.isReal ? "text-pitch-bright" : "text-orange-600") : "text-muted"}`}>
                    {m.scoreA}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                  <span>{flag(m.teamB)}</span>
                  <span className={m.winner === m.teamB ? "font-bold" : "text-muted"}>
                    {name(m.teamB)}
                  </span>
                  <span className={`font-mono font-bold ${m.winner === m.teamB ? (m.isReal ? "text-pitch-bright" : "text-orange-600") : "text-muted"}`}>
                    {m.scoreB}
                  </span>
                </div>
                {m.wentToPenalties && (
                  <div className="text-[9px] text-amber-400 mt-0.5">点球大战</div>
                )}
              </div>
              {/* 连接线 + 箭头 */}
              {idx < result.championPath.length - 1 && (
                <div className="flex items-center shrink-0 w-8">
                  <div className="flex-1 h-px bg-amber-500/40" />
                  <svg width="10" height="10" viewBox="0 0 10 10" className="text-amber-500/60 shrink-0">
                    <path d="M2 1 L8 5 L2 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
