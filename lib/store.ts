import { create } from "zustand";
import { type MonteCarloResult } from "./prediction/monteCarlo";
import { type DetailedSimResult } from "./prediction/detailedSim";
import { teamMoodModifier } from "./mood/moodModel";
import { TEAMS, TEAM_MAP } from "./data/teams";
import { apiUrl } from "./basePath";
import { computeViewpointMods, type Viewpoint, type SourceConfig } from "./viewpoints";
import type { KnownMatchResult, LiveTournamentContext } from "./types";

interface RawSourceConfig { source: string; weight: number | string; enabled: number | boolean }

// 仅用于拉取赛程状态（tournamentStatus）供对阵图展示；模拟本身在后端跑。
async function fetchLiveTournamentContext(): Promise<LiveTournamentContext | undefined> {
  try {
    const res = await fetch(apiUrl("/api/live-results"));
    const data = (await res.json()) as {
      available?: boolean;
      matches?: KnownMatchResult[];
      groupMatches?: KnownMatchResult[];
      tournamentStatus?: unknown;
    };
    return {
      knockoutMatches: data.available ? (data.matches ?? []) : [],
      groupMatches: data.available ? (data.groupMatches ?? []) : [],
      tournamentStatus: data.tournamentStatus,
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
    detailedResult?: DetailedSimResult;
    matchCard?: MatchCardPayload;
    sentimentSnapshot?: {
      total: number;
      teams: { teamId: string; pos: number; neg: number; neu: number; net: number; topSnippet: string; sources: string[] }[];
      generalNotes: string[];
    } | null;
  };
}

// 从 bracket 发送给 FloatingAgent 的比赛卡片数据
export interface MatchCardPayload {
  matchId: string;
  stage: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  wentToPenalties?: boolean;
  // Elo
  eloA: number;
  eloB: number;
  eloDiff: number;
  eloWinProbA: number;
  // 泊松期望进球
  lambdaA: number;
  lambdaB: number;
  // 综合战力
  strengthA: number;
  strengthB: number;
  // 球风
  styleA: string;
  styleB: string;
  styleClashA: number;
  styleClashB: number;
  // 心情修正
  moodModA: number;
  moodModB: number;
  // 胜平负概率
  probWinA: number;
  probDraw: number;
  probWinB: number;
  // 推理链路
  reasoningSteps: string[];
  // 已有 Qwen 分析（可选）
  aiAnalysis?: string;
  aiSource?: string;
}

interface AppState {
  mcResult: MonteCarloResult | null;
  detailedResult: DetailedSimResult | null;
  detailedRunning: boolean;
  liveContext: LiveTournamentContext | null;
  liveContextLoaded: boolean;
  running: boolean;
  progress: { done: number; total: number };
  simCount: number;
  useMood: boolean;
  viewpointMods: Record<string, number>;
  viewpointCount: number;
  // agent 对话历史，跨 tab 切换保留
  agentMessages: AgentChatMessage[];
  agentInitialized: boolean;
  // bracket 比赛卡片 → FloatingAgent 的通信通道
  pendingMatchCard: MatchCardPayload | null;
  runSimulation: (n?: number) => void;
  runDetailedSim: (force?: boolean) => Promise<void>;
  setSimCount: (n: number) => void;
  setUseMood: (v: boolean) => void;
  loadViewpoints: () => Promise<void>;
  setAgentMessages: (msgs: AgentChatMessage[] | ((prev: AgentChatMessage[]) => AgentChatMessage[])) => void;
  setAgentInitialized: (v: boolean) => void;
  clearAgentChat: () => void;
  // Agent 跑完后回写 mcResult，其他页面直接消费，不再重复模拟
  setMcResult: (result: MonteCarloResult) => void;
  // 发送比赛卡片给 FloatingAgent
  sendMatchCard: (card: MatchCardPayload) => void;
  clearPendingMatchCard: () => void;
}

// 计算各队心情修正系数
export function computeMoodMods(): Record<string, number> {
  const mods: Record<string, number> = {};
  for (const t of TEAMS) mods[t.id] = teamMoodModifier(t.id);
  return mods;
}

export const useAppStore = create<AppState>((set, get) => ({
  mcResult: null,
  detailedResult: null,
  detailedRunning: false,
  liveContext: null,
  liveContextLoaded: false,
  running: false,
  progress: { done: 0, total: 0 },
  simCount: 3000,
  useMood: true,
  viewpointMods: {},
  viewpointCount: 0,
  agentMessages: [],
  agentInitialized: false,
  pendingMatchCard: null,
  runSimulation: (n?: number) => {
    const count = n ?? get().simCount;
    set({ running: true, progress: { done: 0, total: count } });
    // 蒙特卡洛模拟在后端运行（/api/simulate），前端只触发与展示。
    fetch(apiUrl("/api/simulate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, useMood: get().useMood }),
    })
      .then((r) => r.json())
      .then((result: MonteCarloResult) => {
        if (!result || !result.topChampions) throw new Error("bad result");
        set({ mcResult: result, running: false, simCount: count, progress: { done: count, total: count } });
        savePrediction(result, count, get().useMood);
      })
      .catch(() => set({ running: false }));
  },
  runDetailedSim: async (force = false) => {
    // 已有结果且不强制重跑则跳过；正在跑时也跳过（防并发）
    if ((get().detailedResult && !force) || get().detailedRunning) return;

    set({ detailedRunning: true });

    // 拉取赛程状态（tournamentStatus，供对阵图进度标签）——不参与模拟
    if (!get().liveContextLoaded || force) {
      const ctx = (await fetchLiveTournamentContext()) ?? null;
      set({ liveContext: ctx, liveContextLoaded: true });
    }

    // 详细赛程模拟在后端运行（/api/simulate-bracket）
    try {
      const res = await fetch(apiUrl("/api/simulate-bracket"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useMood: get().useMood }),
      });
      const data = (await res.json()) as { bracket?: DetailedSimResult };
      set({ detailedResult: data.bracket ?? null, detailedRunning: false });
    } catch {
      set({ detailedRunning: false });
    }
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
  sendMatchCard: (card) => set({ pendingMatchCard: card }),
  clearPendingMatchCard: () => set({ pendingMatchCard: null }),
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
