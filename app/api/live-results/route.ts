import { NextRequest, NextResponse } from "next/server";
import { FOOTBALL_DATA_CACHE_SECONDS, fetchMatchesByStage, apiStatus } from "@/lib/api/client";
import type { LiveMatch } from "@/lib/api/client";
import { TEAMS } from "@/lib/data/teams";

export const dynamic = "force-dynamic";

const LIVE_RESULTS_CACHE_CONTROL = `public, max-age=${FOOTBALL_DATA_CACHE_SECONDS}, s-maxage=${FOOTBALL_DATA_CACHE_SECONDS}, stale-while-revalidate=60`;

function cachedJson(body: unknown) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": LIVE_RESULTS_CACHE_CONTROL,
    },
  });
}

// football-data.org stage → 项目内部 stage key（按顺序排列）
const STAGE_ORDER = ["group", "r32", "r16", "qf", "sf", "final"] as const;
export type StageKey = (typeof STAGE_ORDER)[number];

const API_STAGE_MAP: Record<string, StageKey> = {
  GROUP_STAGE: "group",
  LAST_32: "r32",
  LAST_16: "r16",
  QUARTER_FINALS: "qf",
  SEMI_FINALS: "sf",
  FINAL: "final",
};

// 淘汰赛阶段（按顺序，不含小组赛）
const KNOCKOUT_API_STAGES = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

function tlaToId(tla: string): string {
  return tla.toLowerCase();
}

function getWinnerId(m: LiveMatch): string | null {
  if (m.score.winner === "HOME_TEAM") return tlaToId(m.homeTeam.tla);
  if (m.score.winner === "AWAY_TEAM") return tlaToId(m.awayTeam.tla);
  return null;
}

// 比赛状态三态
// finished   - 已完成，有真实比分
// confirmed  - 双方对手已确定，但比赛尚未开始（对手已知待踢）
// pending    - 对手尚未确定（上一轮未出线）
export type MatchState = "finished" | "confirmed" | "pending";

export interface MatchRecord {
  matchId: string;
  stage: StageKey;
  group?: string;           // 仅小组赛有值，如 "A"
  teamA: string;
  teamB: string;
  scoreA: number | null;   // null = 未完成
  scoreB: number | null;
  winner: string | null;   // null = 未完成
  wentToPenalties: boolean;
  status: string;
  matchState: MatchState;  // 三态区分
  utcDate: string;
}

export interface TournamentStatus {
  currentStage: StageKey;        // 当前正在进行的阶段
  completedStages: StageKey[];   // 已全部完成的阶段
  upcomingStages: StageKey[];    // 尚未开始的阶段
  finishedMatchCount: number;    // 全局已完成场次数
}

function toMatchRecord(m: LiveMatch, stageKey: StageKey): MatchRecord | null {
  const homeId = m.homeTeam?.tla ? tlaToId(m.homeTeam.tla) : null;
  const awayId = m.awayTeam?.tla ? tlaToId(m.awayTeam.tla) : null;
  if (!homeId || !awayId) return null;

  const isFinished = m.status === "FINISHED";
  const winnerId = isFinished ? getWinnerId(m) : null;
  const matchState: MatchState = isFinished ? "finished" : "confirmed";

  // 提取小组字母，如 "GROUP_A" → "A"
  const group = m.group ? m.group.replace(/^GROUP_/, "") : undefined;

  return {
    matchId: `${stageKey}-${homeId}-${awayId}`,
    stage: stageKey,
    ...(group ? { group } : {}),
    teamA: homeId,
    teamB: awayId,
    scoreA: isFinished ? (m.score.fullTime.home ?? null) : null,
    scoreB: isFinished ? (m.score.fullTime.away ?? null) : null,
    winner: winnerId,
    wentToPenalties: m.wentToPenalties,
    status: m.status,
    matchState,
    utcDate: m.utcDate,
  };
}

export async function GET(_req: NextRequest) {
  const status = apiStatus();
  if (!status.available) {
    return cachedJson({
      available: false,
      reason: status.reason,
      matches: [],
      groupMatches: [],
      tournamentStatus: null,
    });
  }

  try {
    // 并行拉取：小组赛全量 + 所有淘汰赛阶段（含未开赛）
    const [groupFinished, ...knockoutResults] = await Promise.all([
      fetchMatchesByStage("GROUP_STAGE"),
      ...KNOCKOUT_API_STAGES.map((s) => fetchMatchesByStage(s).catch(() => [] as LiveMatch[])),
    ]);

    const unknownTeams: string[] = [];

    // ── 小组赛（含已完成与已确认待踢）──
    const groupMatches: MatchRecord[] = [];
    for (const m of groupFinished) {
      const rec = toMatchRecord(m, "group");
      if (!rec) continue;
      if (!TEAMS.some((t) => t.id === rec.teamA)) unknownTeams.push(m.homeTeam.tla);
      if (!TEAMS.some((t) => t.id === rec.teamB)) unknownTeams.push(m.awayTeam.tla);
      groupMatches.push(rec);
    }

    // ── 淘汰赛（含未开赛）──
    const knockoutMatches: MatchRecord[] = [];
    for (let i = 0; i < KNOCKOUT_API_STAGES.length; i++) {
      const apiStage = KNOCKOUT_API_STAGES[i];
      const stageKey = API_STAGE_MAP[apiStage];
      for (const m of knockoutResults[i]) {
        const rec = toMatchRecord(m, stageKey);
        if (!rec) continue;
        if (!TEAMS.some((t) => t.id === rec.teamA)) unknownTeams.push(m.homeTeam.tla);
        if (!TEAMS.some((t) => t.id === rec.teamB)) unknownTeams.push(m.awayTeam.tla);
        knockoutMatches.push(rec);
      }
    }

    const allMatches = [...groupMatches, ...knockoutMatches];

    // ── 计算赛程进度 ──
    const stageGroups: Partial<Record<StageKey, MatchRecord[]>> = {};
    for (const r of allMatches) {
      (stageGroups[r.stage] ||= []).push(r);
    }

    const completedStages: StageKey[] = [];
    const currentStages: StageKey[] = [];
    const upcomingStages: StageKey[] = [];

    for (const key of STAGE_ORDER) {
      const ms = stageGroups[key] ?? [];
      const hasFinished = ms.some((m) => m.status === "FINISHED");
      const allFinished = ms.length > 0 && ms.every((m) => m.status === "FINISHED");
      const hasLive = ms.some((m) => m.status === "LIVE" || m.status === "IN_PLAY");

      if (allFinished) {
        completedStages.push(key);
      } else if (hasFinished || hasLive) {
        currentStages.push(key);
      } else if (ms.length > 0) {
        upcomingStages.push(key);
      }
      // ms.length === 0 的阶段（API 还没数据）暂不列入
    }

    const tournamentStatus: TournamentStatus = {
      currentStage: currentStages[0] ?? upcomingStages[0] ?? completedStages[completedStages.length - 1] ?? "group",
      completedStages,
      upcomingStages,
      finishedMatchCount: allMatches.filter((m) => m.status === "FINISHED").length,
    };

    return cachedJson({
      available: true,
      count: allMatches.length,
      matches: knockoutMatches,       // 淘汰赛（供 detailedSim 构建 bracket）
      groupMatches,                   // 小组赛（供 detailedSim 注入小组结果）
      tournamentStatus,
      ...(unknownTeams.length ? { unknownTeams: [...new Set(unknownTeams)] } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json(
      { available: false, error: message, matches: [], groupMatches: [], tournamentStatus: null },
      { status: 502 }
    );
  }
}
