import { create } from "zustand";
import { runMonteCarlo, type MonteCarloResult } from "./prediction/monteCarlo";
import { teamMoodModifier } from "./mood/moodModel";
import { TEAMS, TEAM_MAP } from "./data/teams";
import { apiUrl } from "./basePath";
import { computeViewpointMods, type Viewpoint, type SourceConfig } from "./viewpoints";
import type { KnownMatchResult, LiveTournamentContext } from "./types";

interface RawSourceConfig { source: string; weight: number | string; enabled: number | boolean }

async function fetchLiveTournamentContext(): Promise<LiveTournamentContext | undefined> {
  try {
    const res = await fetch(apiUrl("/api/live-results"));
    const data = (await res.json()) as {
      available?: boolean;
      matches?: KnownMatchResult[];
      groupMatches?: KnownMatchResult[];
    };
    if (!data.available) return undefined;
    return {
      knockoutMatches: data.matches ?? [],
      groupMatches: data.groupMatches ?? [],
    };
  } catch {
    return undefined;
  }
}

// Persist a completed simulation's champion to the backend (best-effort).
function savePrediction(result: MonteCarloResult, simCount: number, useMood: boolean) {
  const champ = result.topChampions[0];
  if (!champ) return;
  const runner = result.topChampions[1];
  fetch(apiUrl("/api/predictions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      championId: champ.teamId,
      championName: TEAM_MAP[champ.teamId]?.name ?? champ.teamId,
      probability: champ.pct,
      runnerUpId: runner?.teamId,
      runnerUpName: runner ? TEAM_MAP[runner.teamId]?.name ?? runner.teamId : undefined,
      simCount,
      useMood,
    }),
  }).catch(() => {
    // Persistence is best-effort; ignore network/DB errors so the UI is unaffected.
  });
}

export interface AgentChatMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  currentPhase?: string; // 首次推演时的当前阶段，用于驱动进度条
  meta?: {
    topChampions?: { teamId?: string; team: string; probability: number }[];
    finalPrediction?: { teamA: string; teamB: string; score: string; winner: string } | null;
    darkHorses?: { team: string; probability: number; fifaRank: number }[];
    championPath?: { stage: string; match: string; winner: string; state: string }[];
    reasoningChain?: string[];
    dataAudit?: { scheduleSource: string; finishedMatchCount: number };
    reportSource?: string;
    source?: string;
    model?: string;
  };
}

interface AppState {
  mcResult: MonteCarloResult | null;
  running: boolean;
  progress: { done: number; total: number };
  simCount: number;
  useMood: boolean;
  viewpointMods: Record<string, number>;
  viewpointCount: number;
  // agent 对话历史，跨 tab 切换保留
  agentMessages: AgentChatMessage[];
  agentInitialized: boolean;
  runSimulation: (n?: number) => void;
  setSimCount: (n: number) => void;
  setUseMood: (v: boolean) => void;
  loadViewpoints: () => Promise<void>;
  setAgentMessages: (msgs: AgentChatMessage[] | ((prev: AgentChatMessage[]) => AgentChatMessage[])) => void;
  setAgentInitialized: (v: boolean) => void;
  clearAgentChat: () => void;
  // Agent 跑完后回写 mcResult，其他页面直接消费，不再重复模拟
  setMcResult: (result: MonteCarloResult) => void;
}

// 计算各队心情修正系数
export function computeMoodMods(): Record<string, number> {
  const mods: Record<string, number> = {};
  for (const t of TEAMS) mods[t.id] = teamMoodModifier(t.id);
  return mods;
}

export const useAppStore = create<AppState>((set, get) => ({
  mcResult: null,
  running: false,
  progress: { done: 0, total: 0 },
  simCount: 3000,
  useMood: true,
  viewpointMods: {},
  viewpointCount: 0,
  agentMessages: [],
  agentInitialized: false,
  runSimulation: (n?: number) => {
    const count = n ?? get().simCount;
    set({ running: true, progress: { done: 0, total: count } });
    // 异步执行以先渲染 loading
    setTimeout(async () => {
      const moodMods = get().useMood ? computeMoodMods() : {};
      const vpMods = get().viewpointMods;
      const liveContext = await fetchLiveTournamentContext();
      // 合并：心情修正 × 数据源观点修正
      const mods: Record<string, number> = {};
      for (const t of TEAMS) {
        mods[t.id] = (moodMods[t.id] ?? 1) * (vpMods[t.id] ?? 1);
      }
      const result = runMonteCarlo(
        count,
        mods,
        (done, total) => set({ progress: { done, total } }),
        liveContext,
      );
      set({ mcResult: result, running: false, simCount: count });
      savePrediction(result, count, get().useMood);
    }, 60);
  },
  setSimCount: (n) => set({ simCount: n }),
  setUseMood: (v) => set({ useMood: v }),
  setAgentMessages: (msgs) =>
    set((state) => ({
      agentMessages: typeof msgs === "function" ? msgs(state.agentMessages) : msgs,
    })),
  setAgentInitialized: (v) => set({ agentInitialized: v }),
  clearAgentChat: () => set({ agentMessages: [], agentInitialized: false }),
  setMcResult: (result) => set({ mcResult: result, running: false }),
  loadViewpoints: async () => {
    try {
      const [vpRes, cfgRes] = await Promise.all([
        fetch(apiUrl("/api/viewpoints"), { cache: "no-store" }),
        fetch(apiUrl("/api/source-config"), { cache: "no-store" }),
      ]);
      const vpData = (await vpRes.json()) as { viewpoints?: Viewpoint[] };
      const cfgData = (await cfgRes.json()) as { config?: RawSourceConfig[] };
      const vps = vpData.viewpoints ?? [];
      const cfg: SourceConfig[] = (cfgData.config ?? []).map((c) => ({
        source: c.source,
        weight: Number(c.weight),
        enabled: c.enabled === 1 || c.enabled === true,
      }));
      set({
        viewpointMods: computeViewpointMods(vps, TEAMS.map((t) => t.id), cfg),
        viewpointCount: vps.length,
      });
    } catch {
      // ignore — viewpoints are optional
    }
  },
}));
