import { apiStatus, fetchMatchesByStage } from "@/lib/api/client";
import type { LiveMatch } from "@/lib/api/client";
import { TEAMS } from "@/lib/data/teams";
import { getPool, isDbConfigured } from "@/lib/db";
import { teamMoodModifier } from "@/lib/mood/moodModel";
import { runMonteCarlo, type MonteCarloResult } from "@/lib/prediction/monteCarlo";
import {
  simulateDetailedTournament,
  type DetailedSimResult,
} from "@/lib/prediction/detailedSim";
import {
  computeViewpointMods,
  type SourceConfig,
  type Viewpoint,
} from "@/lib/viewpoints";
import type { KnownMatchResult, LiveTournamentContext, Stage } from "@/lib/types";
import { chatWithQwen } from "./qwen";
import {
  buildLocalReport,
  buildQwenPrompt,
  teamLabel,
  type AgentDataAudit,
} from "./report";

const API_STAGE_MAP: Record<string, Stage> = {
  GROUP_STAGE: "group",
  LAST_32: "r32",
  LAST_16: "r16",
  QUARTER_FINALS: "qf",
  SEMI_FINALS: "sf",
  FINAL: "final",
};

const KNOCKOUT_API_STAGES = [
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "FINAL",
];

export interface WorldCupAgentRequest {
  task?: string;
  simCount?: number;
}

export interface WorldCupAgentResponse {
  agent: "WorldCup Predictor Agent";
  task: string;
  intent: "worldcup_prediction" | "team_path" | "group_analysis";
  dataAudit: AgentDataAudit;
  topChampions: { teamId: string; team: string; probability: number }[];
  darkHorses: { teamId: string; team: string; probability: number; fifaRank: number }[];
  finalPrediction: {
    teamA: string;
    teamB: string;
    score: string;
    winner: string;
  } | null;
  championPath: {
    stage: string;
    match: string;
    winner: string;
    state: string;
  }[];
  reasoningChain: string[];
  report: string;
  reportSource: "qwen" | "local";
  model?: string;
  warnings: string[];
}

function tlaToId(tla: string): string {
  return tla.toLowerCase();
}

function getWinnerId(m: LiveMatch): string | null {
  if (m.score.winner === "HOME_TEAM") return tlaToId(m.homeTeam.tla);
  if (m.score.winner === "AWAY_TEAM") return tlaToId(m.awayTeam.tla);
  return null;
}

function toKnownMatch(m: LiveMatch, stage: Stage): KnownMatchResult | null {
  const teamA = m.homeTeam?.tla ? tlaToId(m.homeTeam.tla) : "";
  const teamB = m.awayTeam?.tla ? tlaToId(m.awayTeam.tla) : "";
  if (!teamA || !teamB) return null;

  const finished = m.status === "FINISHED";
  const group = m.group ? m.group.replace(/^GROUP_/, "") : undefined;

  return {
    teamA,
    teamB,
    scoreA: finished ? m.score.fullTime.home ?? null : null,
    scoreB: finished ? m.score.fullTime.away ?? null : null,
    winner: finished ? getWinnerId(m) : null,
    wentToPenalties: m.wentToPenalties,
    stage,
    status: m.status,
    matchState: finished ? "finished" : "confirmed",
    ...(group ? { group } : {}),
    utcDate: m.utcDate,
  };
}

async function getLiveContext(): Promise<{
  context?: LiveTournamentContext;
  warnings: string[];
  liveMatchCount: number;
  finishedMatchCount: number;
}> {
  const status = apiStatus();
  if (!status.available) {
    return {
      warnings: [status.reason ?? "未配置赛程接口，使用内置模拟赛程"],
      liveMatchCount: 0,
      finishedMatchCount: 0,
    };
  }

  try {
    const [groupMatches, ...knockout] = await Promise.all([
      fetchMatchesByStage("GROUP_STAGE"),
      ...KNOCKOUT_API_STAGES.map((stage) =>
        fetchMatchesByStage(stage).catch(() => [] as LiveMatch[]),
      ),
    ]);

    const groupKnown = groupMatches
      .map((m) => toKnownMatch(m, "group"))
      .filter((m): m is KnownMatchResult => !!m);
    const knockoutKnown = knockout.flatMap((matches, idx) => {
      const stage = API_STAGE_MAP[KNOCKOUT_API_STAGES[idx]];
      return matches
        .map((m) => toKnownMatch(m, stage))
        .filter((m): m is KnownMatchResult => !!m);
    });
    const all = [...groupKnown, ...knockoutKnown];

    return {
      context: { groupMatches: groupKnown, knockoutMatches: knockoutKnown },
      warnings: [],
      liveMatchCount: all.length,
      finishedMatchCount: all.filter((m) => m.status === "FINISHED").length,
    };
  } catch (err) {
    return {
      warnings: [err instanceof Error ? err.message : "赛程接口获取失败，使用内置模拟赛程"],
      liveMatchCount: 0,
      finishedMatchCount: 0,
    };
  }
}

async function loadViewpoints(): Promise<{
  viewpoints: Viewpoint[];
  sourceConfig: SourceConfig[];
}> {
  if (!isDbConfigured()) return { viewpoints: [], sourceConfig: [] };

  try {
    const pool = getPool();
    const [viewpointRows] = await pool.query(
      `SELECT id, scope, team_id AS teamId, category, stance, weight, content, link, author, source, created_at AS createdAt
         FROM wc_viewpoints ORDER BY created_at DESC LIMIT 500`,
    );
    const [configRows] = await pool.query(
      "SELECT source, weight, enabled FROM wc_source_config ORDER BY source",
    );

    const viewpoints = (viewpointRows as Viewpoint[]).map((v) => ({
      ...v,
      weight: Number(v.weight),
    }));
    const sourceConfig = (configRows as { source: string; weight: unknown; enabled: unknown }[]).map((c) => ({
      source: c.source,
      weight: Number(c.weight),
      enabled: c.enabled === 1 || c.enabled === true,
    }));
    return { viewpoints, sourceConfig };
  } catch {
    return { viewpoints: [], sourceConfig: [] };
  }
}

function computeAgentMods(viewpoints: Viewpoint[], sourceConfig: SourceConfig[]) {
  const vpMods = computeViewpointMods(
    viewpoints,
    TEAMS.map((team) => team.id),
    sourceConfig,
  );
  const mods: Record<string, number> = {};
  for (const team of TEAMS) {
    mods[team.id] = (teamMoodModifier(team.id) ?? 1) * (vpMods[team.id] ?? 1);
  }
  return mods;
}

function inferIntent(task: string): WorldCupAgentResponse["intent"] {
  if (/组|group/i.test(task)) return "group_analysis";
  if (/路径|夺冠路|晋级路|path/i.test(task)) return "team_path";
  return "worldcup_prediction";
}

function buildResponseShape(
  task: string,
  simCount: number,
  audit: AgentDataAudit,
  mc: MonteCarloResult,
  detailed: DetailedSimResult,
  report: string,
  reportMeta: { source: "qwen" | "local"; model?: string },
  warnings: string[],
): WorldCupAgentResponse {
  const finalMatch = detailed.knockout.find((m) => m.stage === "final");
  const topChampions = mc.topChampions.slice(0, 8).map((row) => ({
    teamId: row.teamId,
    team: teamLabel(row.teamId),
    probability: row.pct,
  }));
  const darkHorses = mc.topChampions
    .map((row) => ({
      teamId: row.teamId,
      team: teamLabel(row.teamId),
      probability: row.pct,
      fifaRank: TEAMS.find((team) => team.id === row.teamId)?.fifaRank ?? 99,
    }))
    .filter((row) => row.fifaRank > 10 && row.probability > 0.005)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  return {
    agent: "WorldCup Predictor Agent",
    task,
    intent: inferIntent(task),
    dataAudit: audit,
    topChampions,
    darkHorses,
    finalPrediction: finalMatch
      ? {
          teamA: teamLabel(finalMatch.teamA),
          teamB: teamLabel(finalMatch.teamB),
          score: `${finalMatch.scoreA}-${finalMatch.scoreB}`,
          winner: teamLabel(finalMatch.winner),
        }
      : null,
    championPath: detailed.championPath.map((m) => ({
      stage: m.stage,
      match: `${teamLabel(m.teamA)} ${m.scoreA}-${m.scoreB} ${teamLabel(m.teamB)}`,
      winner: teamLabel(m.winner),
      state: m.matchState,
    })),
    reasoningChain: [
      "采集真实赛程/赛果，已完成比赛直接锁定结果。",
      "合并球队种子评分、球员心情模型和舆情观点修正。",
      "用泊松期望进球模型模拟未知比赛比分。",
      "淘汰赛平局使用 Elo 点球模型决出胜者。",
      `重复 ${simCount.toLocaleString()} 次完整锦标赛，聚合晋级与夺冠概率。`,
      "将结构化结果交给 Qwen 或本地模板生成中文可解释报告。",
    ],
    report,
    reportSource: reportMeta.source,
    ...(reportMeta.model ? { model: reportMeta.model } : {}),
    warnings,
  };
}

export async function runWorldCupAgent(
  input: WorldCupAgentRequest,
): Promise<WorldCupAgentResponse> {
  const task = (input.task || "预测世界杯冠军").trim().slice(0, 160);
  const simCount = Math.max(500, Math.min(10000, Number(input.simCount) || 3000));

  const [live, viewpointData] = await Promise.all([getLiveContext(), loadViewpoints()]);
  const mods = computeAgentMods(viewpointData.viewpoints, viewpointData.sourceConfig);
  const mc = runMonteCarlo(simCount, mods, undefined, live.context);
  const detailed = simulateDetailedTournament(
    mods,
    live.context?.knockoutMatches ?? [],
    live.context?.groupMatches ?? [],
  );

  const audit: AgentDataAudit = {
    scheduleSource: live.context ? "football-data.org" : "内置种子赛程",
    ratingsSource: "项目内置 Elo/六维评分 + 心情/舆情修正",
    viewpointCount: viewpointData.viewpoints.length,
    liveMatchCount: live.liveMatchCount,
    finishedMatchCount: live.finishedMatchCount,
    cachePolicy: "赛程/赛果 10 分钟缓存",
  };

  const reportInput = { task, simCount, audit, monteCarlo: mc, detailed };
  const fallback = buildLocalReport(reportInput);
  const qwenPayload = buildQwenPrompt(reportInput);
  const qwen = await chatWithQwen(
    [
      {
        role: "system",
        content: `你是世界杯冠军预测 AI Agent，具备顶级赛事分析能力。基于结构化预测数据输出深度分析报告，要求：
1. **数据驱动**：所有结论必须源自输入数据，不编造
2. **层次清晰**：分"热门分析 → 黑马揭秘 → 决赛预测 → 不确定性"四段
3. **专业洞察**：加入 Elo 差值、泊松期望进球等量化依据
4. **可读性强**：使用 **加粗** 强调关键数据，语气自信有力
5. **字数控制**：600 字以内，每段不超过 3 句`,
      },
      {
        role: "user",
        content: `任务：${task}\n\n预测数据：\n${qwenPayload}`,
      },
    ],
    fallback,
    { temperature: 0.4, maxTokens: 1200 },
  );

  return buildResponseShape(
    task,
    simCount,
    audit,
    mc,
    detailed,
    qwen.content,
    { source: qwen.source, model: qwen.model },
    [...live.warnings, ...(qwen.error ? [`Qwen降级：${qwen.error}`] : [])],
  );
}
