import type { StageProbabilities } from "../types";
import { TEAMS } from "../data/teams";
import { simulateTournament } from "./simulator";

const STAGE_RANK: Record<string, number> = {
  group: 0,
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  final: 5,
  champion: 6,
};

export interface MonteCarloResult {
  probabilities: StageProbabilities[];
  championCounts: Record<string, number>;
  runnerUpCounts: Record<string, number>;
  finalCounts: Record<string, number>; // 进决赛次数
  n: number;
  topChampions: { teamId: string; count: number; pct: number }[];
}

export function runMonteCarlo(
  n: number,
  moodMods: Record<string, number> = {},
  onProgress?: (done: number, total: number) => void
): MonteCarloResult {
  const reach: Record<string, number[]> = {}; // [r32,r16,qf,sf,final,champion] counts
  const championCounts: Record<string, number> = {};
  const runnerUpCounts: Record<string, number> = {};
  const finalCounts: Record<string, number> = {};

  for (const t of TEAMS) {
    reach[t.id] = [0, 0, 0, 0, 0, 0];
    championCounts[t.id] = 0;
    runnerUpCounts[t.id] = 0;
    finalCounts[t.id] = 0;
  }

  for (let i = 0; i < n; i++) {
    const res = simulateTournament(moodMods);
    for (const t of TEAMS) {
      const rank = STAGE_RANK[res.stageReached[t.id] ?? "group"];
      // 累加：抵达某阶段及以上则对应档位 +1
      if (rank >= 1) reach[t.id][0]++; // r32
      if (rank >= 2) reach[t.id][1]++; // r16
      if (rank >= 3) reach[t.id][2]++; // qf
      if (rank >= 4) reach[t.id][3]++; // sf
      if (rank >= 5) reach[t.id][4]++; // final
      if (rank >= 6) reach[t.id][5]++; // champion
    }
    championCounts[res.champion]++;
    runnerUpCounts[res.runnerUp]++;
    finalCounts[res.champion]++;
    finalCounts[res.runnerUp]++;

    if (onProgress && (i % 200 === 0 || i === n - 1)) onProgress(i + 1, n);
  }

  const probabilities: StageProbabilities[] = TEAMS.map((t) => {
    const c = reach[t.id];
    return {
      teamId: t.id,
      r32: c[0] / n,
      r16: c[1] / n,
      qf: c[2] / n,
      sf: c[3] / n,
      final: c[4] / n,
      champion: c[5] / n,
    };
  });

  const topChampions = TEAMS.map((t) => ({
    teamId: t.id,
    count: championCounts[t.id],
    pct: championCounts[t.id] / n,
  }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    probabilities,
    championCounts,
    runnerUpCounts,
    finalCounts,
    n,
    topChampions,
  };
}
