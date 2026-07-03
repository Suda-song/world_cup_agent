import type { Team, Player, HistoryRecord } from "../types";
import { TEAMS, TEAM_MAP, teamsInGroup, GROUPS } from "./teams";
import { PLAYERS, playersOf, PLAYER_MAP } from "./players";
import { HISTORY, findHistory } from "./history";
import { apiStatus } from "../api/client";

// 缓存数据结构（与 data/cache.json 对应）
export interface CacheData {
  fetchedAt: string;
  source: "api" | "seed";
  teams: Team[];
  players: Player[];
  history: HistoryRecord[];
}

// 运行时数据集（统一接口）
export interface Dataset {
  teams: Team[];
  teamMap: Record<string, Team>;
  players: Player[];
  playerMap: Record<string, Player[]>;
  history: HistoryRecord[];
  source: "api" | "seed";
  fetchedAt: string;
}

// 内联缓存（避免重复解析）
let cache: Dataset | null = null;

function buildDataset(data: CacheData): Dataset {
  const teamMap: Record<string, Team> = {};
  for (const t of data.teams) teamMap[t.id] = t;
  const playerMap: Record<string, Player[]> = {};
  for (const pl of data.players) {
    (playerMap[pl.teamId] ||= []).push(pl);
  }
  return {
    teams: data.teams,
    teamMap,
    players: data.players,
    playerMap,
    history: data.history,
    source: data.source,
    fetchedAt: data.fetchedAt,
  };
}

function seedDataset(): Dataset {
  return {
    teams: TEAMS,
    teamMap: TEAM_MAP,
    players: PLAYERS,
    playerMap: PLAYER_MAP,
    history: HISTORY,
    source: "seed",
    fetchedAt: new Date("2026-06-01T00:00:00Z").toISOString(),
  };
}

// 主加载入口：优先读本地缓存(cache.json)，无则用种子数据
export function loadDataset(): Dataset {
  if (cache) return cache;

  // 服务端尝试读取缓存文件
  if (typeof window === "undefined") {
    try {
      // 动态 require 避免在客户端打包
      const fs = require("fs");
      const path = require("path");
      const cachePath = path.join(process.cwd(), "data", "cache.json");
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, "utf-8");
        const data: CacheData = JSON.parse(raw);
        // 仅使用完整缓存（含球员数据），避免占位 API 数据覆盖富种子数据
        if (data?.teams?.length && data.players.length > 0) {
          cache = buildDataset(data);
          return cache;
        }
      }
    } catch {
      // 读取失败则回退种子
    }
  }

  cache = seedDataset();
  return cache;
}

// 便捷访问器
export function getTeams(): Team[] {
  return loadDataset().teams;
}
export function getTeam(id: string): Team | undefined {
  return loadDataset().teamMap[id];
}
export function getPlayers(): Player[] {
  return loadDataset().players;
}
export function getPlayersOf(teamId: string): Player[] {
  return loadDataset().playerMap[teamId] ?? playersOf(teamId);
}
export function getHistory(): HistoryRecord[] {
  return loadDataset().history;
}
export function getFindHistory(a: string, b: string) {
  const h = loadDataset().history.find(
    (r) => (r.teamA === a && r.teamB === b) || (r.teamA === b && r.teamB === a)
  );
  return h ?? findHistory(a, b);
}
export { teamsInGroup, GROUPS, apiStatus };
