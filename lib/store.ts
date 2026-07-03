import { create } from "zustand";
import { runMonteCarlo, type MonteCarloResult } from "./prediction/monteCarlo";
import { teamMoodModifier } from "./mood/moodModel";
import { TEAMS, TEAM_MAP } from "./data/teams";
import { apiUrl } from "./basePath";

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

interface AppState {
  mcResult: MonteCarloResult | null;
  running: boolean;
  progress: { done: number; total: number };
  simCount: number;
  useMood: boolean;
  runSimulation: (n?: number) => void;
  setSimCount: (n: number) => void;
  setUseMood: (v: boolean) => void;
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
  runSimulation: (n?: number) => {
    const count = n ?? get().simCount;
    set({ running: true, progress: { done: 0, total: count } });
    // 异步执行以先渲染 loading
    setTimeout(() => {
      const moodMods = get().useMood ? computeMoodMods() : {};
      const result = runMonteCarlo(count, moodMods, (done, total) =>
        set({ progress: { done, total } })
      );
      set({ mcResult: result, running: false, simCount: count });
      savePrediction(result, count, get().useMood);
    }, 60);
  },
  setSimCount: (n) => set({ simCount: n }),
  setUseMood: (v) => set({ useMood: v }),
}));
