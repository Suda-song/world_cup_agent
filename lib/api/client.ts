import type { Team, Player, HistoryRecord } from "../types";

// API-Football 适配器：按 env FOOTBALL_API_KEY 抓取真实数据
// 无 key 时不可用，调用方应捕获错误并回退到种子数据
// 文档: https://www.api-football.com/documentation/v3

const BASE = "https://v3.football.api-sports.io";

function headers(): HeadersInit {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) throw new Error("缺少 FOOTBALL_API_KEY 环境变量");
  return { "x-apisports-key": key };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`API 请求失败: ${res.status}`);
  const json = await res.json();
  return json.response as T;
}

export interface ApiStatus {
  available: boolean;
  reason?: string;
}

export function apiStatus(): ApiStatus {
  if (!process.env.FOOTBALL_API_KEY) {
    return { available: false, reason: "未配置 FOOTBALL_API_KEY，使用内置种子数据" };
  }
  return { available: true };
}

// 抓取世界杯赛程球队（league=1 为世界杯）
export async function fetchTeams(): Promise<Team[]> {
  // 此为示意抓取逻辑：真实响应字段需按 API-Football 文档映射
  const data = await get<any[]>(`/teams?league=1&season=2026`);
  // 映射为本地 Team 结构（保留种子兜底，这里仅作能力演示）
  return data.map((t) => ({
    id: String(t.team?.id ?? ""),
    name: t.team?.name ?? "",
    flag: t.team?.logo ?? "🏳️",
    elo: 1500,
    fifaRank: 0,
    group: "?",
    confederation: "UEFA",
    style: "balanced",
    ratings: { attack: 65, defense: 65, midfield: 65, speed: 65, experience: 65, form: 65 },
  }));
}

export async function fetchPlayers(_teamId: string): Promise<Player[]> {
  // 真实抓取需按球队 ID 查询阵容
  return [];
}

export async function fetchHistory(_a: string, _b: string): Promise<HistoryRecord[]> {
  return [];
}
