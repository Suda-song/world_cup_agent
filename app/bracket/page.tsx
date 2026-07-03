"use client";

import { useState, useEffect } from "react";
import { simulateDetailedTournament, type DetailedSimResult, type MatchReasoning as MatchReason } from "@/lib/prediction/detailedSim";
import { computeMoodMods } from "@/lib/store";
import MatchReasoningPanel from "@/components/bracket/MatchReasoning";
import { getTeam } from "@/lib/data/loader";

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

  useEffect(() => {
    const moodMods = useMood ? computeMoodMods() : {};
    setResult(simulateDetailedTournament(moodMods));
    setSelectedMatch(null);
  }, [useMood, simKey]);

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
            完整赛果预测：小组赛 → 32强 → 16强 → 1/4决赛 → 半决赛 → 决赛 · 含比分预测与推理链路
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

      {/* 冠军展示 */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-pitch/10 to-transparent border border-amber-500/20 p-5 flex items-center gap-5">
        <div className="text-5xl">🏆</div>
        <div className="flex-1">
          <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">预测冠军</div>
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
          <div className="text-xs text-muted">场（含点球 {result.knockout.filter(m => m.wentToPenalties).length} 场）</div>
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
              className="rounded-xl border border-border bg-surface/60 overflow-hidden"
            >
              <div className="px-3 py-1.5 bg-surface-2 text-xs font-bold border-b border-border">
                {grp.group} 组
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
                    <span className="flex-1 truncate font-medium">{row.team.name}</span>
                    <span className="text-muted text-[10px]">
                      {row.pts}分 {row.gf}:{row.ga}
                    </span>
                    {idx === 0 && <span className="text-[9px] text-pitch-bright">1st</span>}
                    {idx === 1 && <span className="text-[9px] text-data">2nd</span>}
                    {idx === 2 && <span className="text-[9px] text-amber-400">3rd</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-pitch/30" />小组头名</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-data/20" />小组次名</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500/20" />第三名（前8晋级）</span>
        </div>
      </div>

      {/* 淘汰赛对阵图 + 推理面板 */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        {/* 对阵图 */}
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-pitch-bright" />
            淘汰赛对阵图
          </h2>
          <div className="overflow-x-auto pb-3">
            <div className="flex gap-3 min-w-max">
              {STAGES.map((stage) => {
                const matches = matchesByStage(stage);
                return (
                  <div key={stage} className="flex flex-col" style={{ minWidth: 200 }}>
                    <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2 text-center">
                      {STAGE_LABEL[stage]}
                    </div>
                    <div
                      className="flex flex-col gap-2"
                      style={{
                        justifyContent:
                          stage === "final" ? "center" : "flex-start",
                        paddingTop:
                          stage === "r16"
                            ? 24
                            : stage === "qf"
                            ? 56
                            : stage === "sf"
                            ? 120
                            : stage === "final"
                            ? 0
                            : 0,
                      }}
                    >
                      {matches.map((m, idx) => {
                        const isChamp = isChampionMatch(m);
                        const isSelected =
                          selectedMatch?.matchId === m.matchId;
                        return (
                          <div
                            key={m.matchId}
                            onClick={() => handleMatchClick(m)}
                            className={`rounded-xl border p-2.5 cursor-pointer transition-all ${
                              isSelected
                                ? "border-pitch-bright bg-pitch/10 glow-pitch"
                                : isChamp
                                ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                                : "border-border bg-surface/60 hover:border-pitch/40 hover:bg-surface-2"
                            }`}
                          >
                            {/* Team A */}
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-base">{flag(m.teamA)}</span>
                              <span className={`flex-1 truncate ${m.winner === m.teamA ? "font-bold text-foreground" : "text-muted"}`}>
                                {name(m.teamA)}
                              </span>
                              <span className={`font-mono font-bold ${m.winner === m.teamA ? "text-pitch-bright" : "text-muted"}`}>
                                {m.scoreA}
                              </span>
                            </div>
                            {/* Team B */}
                            <div className="flex items-center gap-1.5 text-xs mt-1">
                              <span className="text-base">{flag(m.teamB)}</span>
                              <span className={`flex-1 truncate ${m.winner === m.teamB ? "font-bold text-foreground" : "text-muted"}`}>
                                {name(m.teamB)}
                              </span>
                              <span className={`font-mono font-bold ${m.winner === m.teamB ? "text-pitch-bright" : "text-muted"}`}>
                                {m.scoreB}
                              </span>
                            </div>
                            {m.wentToPenalties && (
                              <div className="text-[9px] text-amber-400 mt-1 text-center">
                                点球大战
                              </div>
                            )}
                            {isChamp && !isSelected && (
                              <div className="text-[9px] text-amber-400 mt-1 text-center">
                                ★ 冠军之路
                              </div>
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

        {/* 推理面板 */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          {selectedMatch ? (
            <MatchReasoningPanel
              match={selectedMatch}
              championId={result.champion}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-8 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-sm font-medium text-muted">
                点击左侧比赛卡片
              </div>
              <div className="text-xs text-muted mt-1">
                查看预测推理链路、关键指标与 Qwen AI 赛事分析
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 冠军之路 */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-amber-400" />
          冠军晋级之路
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {result.championPath.map((m, idx) => (
            <div
              key={m.matchId}
              className="flex items-center gap-2 shrink-0"
            >
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 min-w-[140px]">
                <div className="text-[10px] text-amber-400 font-semibold mb-1">
                  {STAGE_LABEL[m.stage]}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span>{flag(m.teamA)}</span>
                  <span className={m.winner === m.teamA ? "font-bold" : "text-muted"}>
                    {name(m.teamA)}
                  </span>
                  <span className={`font-mono font-bold ${m.winner === m.teamA ? "text-pitch-bright" : ""}`}>
                    {m.scoreA}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                  <span>{flag(m.teamB)}</span>
                  <span className={m.winner === m.teamB ? "font-bold" : "text-muted"}>
                    {name(m.teamB)}
                  </span>
                  <span className={`font-mono font-bold ${m.winner === m.teamB ? "text-pitch-bright" : ""}`}>
                    {m.scoreB}
                  </span>
                </div>
                {m.wentToPenalties && (
                  <div className="text-[9px] text-amber-400 mt-0.5">点球大战</div>
                )}
              </div>
              {idx < result.championPath.length - 1 && (
                <span className="text-amber-400/50 text-lg">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
