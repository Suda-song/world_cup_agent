"use client";

import { useState } from "react";
import { getTeam } from "@/lib/data/loader";
import { apiUrl } from "@/lib/basePath";

interface ReasoningData {
  matchId: string;
  stage: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  wentToPenalties?: boolean;
  eloA: number;
  eloB: number;
  eloDiff: number;
  eloWinProbA: number;
  strengthA: number;
  strengthB: number;
  lambdaA: number;
  lambdaB: number;
  styleClashA: number;
  styleClashB: number;
  styleA: string;
  styleB: string;
  moodModA: number;
  moodModB: number;
  hostBoostA: boolean;
  hostBoostB: boolean;
  reasoningSteps: string[];
  probWinA: number;
  probDraw: number;
  probWinB: number;
}

const STAGE_LABEL: Record<string, string> = {
  r32: "32强",
  r16: "16强",
  qf: "1/4决赛",
  sf: "半决赛",
  final: "决赛",
};

const STYLE_LABEL: Record<string, string> = {
  possession: "控球",
  counter: "反击",
  press: "高压",
  defensive: "防守",
  balanced: "均衡",
};

function teamName(id: string): string {
  return getTeam(id)?.name || id;
}

function teamFlagFull(id: string): string {
  return getTeam(id)?.flag || "🏳️";
}

export default function MatchReasoning({
  match,
  championId,
}: {
  match: ReasoningData;
  championId: string;
}) {
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState<string>("");

  const fetchAIAnalysis = async () => {
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const res = await fetch(apiUrl("/api/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamA: teamName(match.teamA),
          teamB: teamName(match.teamB),
          flagA: teamFlagFull(match.teamA),
          flagB: teamFlagFull(match.teamB),
          stage: match.stage,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          wentToPenalties: match.wentToPenalties,
          eloA: match.eloA,
          eloB: match.eloB,
          lambdaA: match.lambdaA,
          lambdaB: match.lambdaB,
          styleA: STYLE_LABEL[match.styleA] || match.styleA,
          styleB: STYLE_LABEL[match.styleB] || match.styleB,
          strengthA: match.strengthA,
          strengthB: match.strengthB,
          moodModA: match.moodModA,
          moodModB: match.moodModB,
          reasoningSteps: match.reasoningSteps,
        }),
      });
      const data = await res.json();
      setAiAnalysis(data.analysis);
      setAiSource(data.source);
    } catch {
      setAiAnalysis("分析获取失败，请重试。");
    } finally {
      setAiLoading(false);
    }
  };

  const isChampionMatch =
    match.teamA === championId || match.teamB === championId;
  const winnerName = teamName(match.winner);
  const winnerIsA = match.winner === match.teamA;

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5 space-y-4">
      {/* 比赛标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-pitch/20 text-pitch-bright font-medium">
            {STAGE_LABEL[match.stage] || match.stage}
          </span>
          {isChampionMatch && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
              冠军之路
            </span>
          )}
        </div>
        <div className="text-sm text-muted">推理链路</div>
      </div>

      {/* 比分展示 */}
      <div className="flex items-center justify-center gap-4 py-3">
        <div className={`text-center ${winnerIsA ? "opacity-100" : "opacity-60"}`}>
          <div className="text-3xl">{teamFlagFull(match.teamA)}</div>
          <div className="text-sm font-medium mt-1">{teamName(match.teamA)}</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold tracking-wider">
            <span className={winnerIsA ? "text-pitch-bright" : "text-muted"}>
              {match.scoreA}
            </span>
            <span className="text-muted mx-2">:</span>
            <span className={!winnerIsA ? "text-pitch-bright" : "text-muted"}>
              {match.scoreB}
            </span>
          </div>
          {match.wentToPenalties && (
            <div className="text-[10px] text-amber-400 mt-1">点球大战</div>
          )}
        </div>
        <div className={`text-center ${!winnerIsA ? "opacity-100" : "opacity-60"}`}>
          <div className="text-3xl">{teamFlagFull(match.teamB)}</div>
          <div className="text-sm font-medium mt-1">{teamName(match.teamB)}</div>
        </div>
      </div>

      {/* 胜平负概率条 */}
      <div className="flex h-2 rounded-full overflow-hidden">
        <div
          className="bg-pitch-bright/70"
          style={{ width: `${match.probWinA * 100}%` }}
          title={`${teamName(match.teamA)} 胜 ${(match.probWinA * 100).toFixed(1)}%`}
        />
        <div
          className="bg-muted/40"
          style={{ width: `${match.probDraw * 100}%` }}
          title={`平局 ${(match.probDraw * 100).toFixed(1)}%`}
        />
        <div
          className="bg-data/70"
          style={{ width: `${match.probWinB * 100}%` }}
          title={`${teamName(match.teamB)} 胜 ${(match.probWinB * 100).toFixed(1)}%`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted">
        <span>{teamName(match.teamA)} {(match.probWinA * 100).toFixed(1)}%</span>
        <span>平局 {(match.probDraw * 100).toFixed(1)}%</span>
        <span>{teamName(match.teamB)} {(match.probWinB * 100).toFixed(1)}%</span>
      </div>

      {/* 推理步骤 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider">
          决策链路
        </div>
        {match.reasoningSteps.map((step, i) => (
          <div key={i} className="flex gap-2.5 text-xs">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-5 h-5 rounded-full bg-pitch/20 text-pitch-bright text-[10px] flex items-center justify-center font-bold">
                {i + 1}
              </div>
              {i < match.reasoningSteps.length - 1 && (
                <div className="w-px h-full min-h-[20px] bg-border mt-1" />
              )}
            </div>
            <p className="text-foreground/80 leading-relaxed pb-2">{step}</p>
          </div>
        ))}
      </div>

      {/* 关键指标网格 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-surface-2 p-2.5">
          <div className="text-muted text-[10px]">Elo 差值</div>
          <div className="font-mono font-bold text-foreground">
            {match.eloDiff > 0 ? "+" : ""}{match.eloDiff.toFixed(0)}
          </div>
        </div>
        <div className="rounded-lg bg-surface-2 p-2.5">
          <div className="text-muted text-[10px]">战力差值</div>
          <div className="font-mono font-bold text-foreground">
            {(match.strengthA - match.strengthB > 0 ? "+" : "")}
            {(match.strengthA - match.strengthB).toFixed(1)}
          </div>
        </div>
        <div className="rounded-lg bg-surface-2 p-2.5">
          <div className="text-muted text-[10px]">期望进球 λ</div>
          <div className="font-mono font-bold text-foreground">
            {match.lambdaA.toFixed(2)} : {match.lambdaB.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg bg-surface-2 p-2.5">
          <div className="text-muted text-[10px]">球风修正</div>
          <div className="font-mono font-bold text-foreground">
            ×{match.styleClashA.toFixed(2)} / ×{match.styleClashB.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Qwen AI 分析 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider">
            AI 赛事分析
          </div>
          <button
            onClick={fetchAIAnalysis}
            disabled={aiLoading}
            className="text-xs px-3 py-1 rounded-lg bg-gradient-to-r from-purple-500/30 to-indigo-500/30 border border-purple-500/30 text-purple-300 hover:from-purple-500/40 hover:to-indigo-500/40 transition-all disabled:opacity-50"
          >
            {aiLoading ? "分析中..." : aiAnalysis ? "重新分析" : "🤖 AI 分析"}
          </button>
        </div>
        {aiAnalysis && (
          <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              {aiSource === "qwen" ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  Qwen-Turbo
                </span>
              ) : aiSource === "minimax" ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  MiniMax
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                  本地分析
                </span>
              )}
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {aiAnalysis}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
