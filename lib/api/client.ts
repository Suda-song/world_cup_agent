import type { Team, HistoryRecord } from "../types";

// football-data.org v4 适配器
// 认证方式: X-Auth-Token header
// 文档: https://www.football-data.org/documentation/quickstart
// 世界杯 competition id: 2000

const BASE = "https://api.football-data.org/v4";
const WC_ID = 2000;
export const FOOTBALL_DATA_CACHE_SECONDS = 600;

function headers(): HeadersInit {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new Error("缺少 FOOTBALL_DATA_API_KEY 环境变量");
  return { "X-Auth-Token": key };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: headers(),
    next: { revalidate: FOOTBALL_DATA_CACHE_SECONDS }, // 10 分钟缓存
  });
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    throw new Error(`football-data.org API 请求失败: ${res.status} ${res.statusText} — ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface ApiStatus {
  available: boolean;
  reason?: string;
}

export function apiStatus(): ApiStatus {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return {
      available: false,
      reason: "未配置 FOOTBALL_DATA_API_KEY，使用内置种子数据",
    };
  }
  return { available: true };
}

// ─── 原始 API 类型 ───────────────────────────────────────────────────────────

interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

interface ApiScore {
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

interface ApiMatch {
  id: number;
  utcDate: string;
  status:
    | "SCHEDULED"
    | "LIVE"
    | "IN_PLAY"
    | "PAUSED"
    | "FINISHED"
    | "POSTPONED"
    | "SUSPENDED"
    | "CANCELLED";
  stage: string;
  group: string | null;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: ApiScore;
}

// ─── 本地类型（供外部使用）────────────────────────────────────────────────────

export interface LiveMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;       // 原始 API stage 值，如 "LAST_32"
  group: string | null; // 小组赛时为 "GROUP_A" 等，淘汰赛为 null
  homeTeam: { id: number; name: string; tla: string; crest: string };
  awayTeam: { id: number; name: string; tla: string; crest: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
  };
  wentToPenalties: boolean;
}

// ─── 接口函数 ────────────────────────────────────────────────────────────────

/**
 * 获取世界杯所有已完成比赛，可按 stage 过滤
 * stage 取值: GROUP_STAGE | LAST_32 | LAST_16 | QUARTER_FINALS | SEMI_FINALS | FINAL
 */
export async function fetchFinishedMatches(
  stage?: string,
): Promise<LiveMatch[]> {
  let path = `/competitions/${WC_ID}/matches?status=FINISHED`;
  if (stage) path += `&stage=${stage}`;
  const data = await get<{ matches: ApiMatch[] }>(path);
  return (data.matches ?? []).map(toLocalMatch);
}

/**
 * 获取世界杯某个阶段的所有比赛（含未开赛）
 */
export async function fetchMatchesByStage(stage: string): Promise<LiveMatch[]> {
  const data = await get<{ matches: ApiMatch[] }>(
    `/competitions/${WC_ID}/matches?stage=${stage}`,
  );
  return (data.matches ?? []).map(toLocalMatch);
}

/**
 * 获取世界杯所有球队（仅含基本信息，无 elo/ratings，需与种子数据 merge）
 */
export async function fetchTeams(): Promise<Pick<Team, "id" | "name">[]> {
  const data = await get<{ teams: ApiTeam[] }>(
    `/competitions/${WC_ID}/teams?season=2026`,
  );
  return (data.teams ?? []).map((t) => ({
    id: t.tla.toLowerCase(), // 与种子数据的 id 对齐（如 "ESP"→"esp"）
    name: t.shortName || t.name,
  }));
}

/**
 * 获取两队历史交锋记录（通过 head2head 接口）
 * matchId: 两队最近一场比赛的 match id
 */
export async function fetchHead2Head(
  matchId: number,
): Promise<HistoryRecord | null> {
  try {
    const data = await get<{
      matches: ApiMatch[];
      aggregates: {
        numberOfMatches: number;
        homeTeam: { wins: number };
        awayTeam: { wins: number };
      };
    }>(`/matches/${matchId}/head2head?limit=20`);

    const matches = data.matches ?? [];
    if (!matches.length) return null;

    const first = matches[0];
    const homeId = first.homeTeam.tla.toLowerCase();
    const awayId = first.awayTeam.tla.toLowerCase();

    let aWins = 0,
      draws = 0,
      bWins = 0;
    for (const m of matches) {
      if (m.score.winner === "HOME_TEAM") aWins++;
      else if (m.score.winner === "AWAY_TEAM") bWins++;
      else draws++;
    }

    return {
      teamA: homeId,
      teamB: awayId,
      played: matches.length,
      aWins,
      draws,
      bWins,
      lastMeeting: matches[matches.length - 1]?.utcDate?.slice(0, 10) ?? "",
    };
  } catch {
    return null;
  }
}

// ─── 内部工具 ────────────────────────────────────────────────────────────────

function toLocalMatch(m: ApiMatch): LiveMatch {
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: m.status,
    stage: m.stage,
    group: m.group,
    homeTeam: {
      id: m.homeTeam.id,
      name: m.homeTeam.shortName || m.homeTeam.name,
      tla: m.homeTeam.tla,
      crest: m.homeTeam.crest,
    },
    awayTeam: {
      id: m.awayTeam.id,
      name: m.awayTeam.shortName || m.awayTeam.name,
      tla: m.awayTeam.tla,
      crest: m.awayTeam.crest,
    },
    score: {
      winner: m.score.winner,
      duration: m.score.duration,
      fullTime: m.score.fullTime,
    },
    wentToPenalties:
      m.score.duration === "PENALTY_SHOOTOUT" ||
      m.score.duration === "EXTRA_TIME",
  };
}
