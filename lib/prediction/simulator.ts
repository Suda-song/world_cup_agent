import type { Team, Stage, MatchResult } from "../types";
import { TEAMS } from "../data/teams";
import { teamsInGroup, GROUPS } from "../data/loader";
import { simulateMatch } from "./poisson";
import { teamStrength } from "./elo";

export interface SimResult {
  champion: string;
  runnerUp: string;
  stageReached: Record<string, Stage>; // 每队最远抵达阶段
  matches: MatchResult[];
}

interface GroupStanding {
  team: Team;
  pts: number;
  gf: number;
  ga: number;
}

function sortStandings(rows: GroupStanding[]): GroupStanding[] {
  return rows.sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
}

// 标准种子对阵表（保护高种子）
function seedOrder(n: number): number[] {
  let pls = [1, 2];
  while (pls.length < n) {
    const out: number[] = [];
    const sum = pls.length * 2 + 1;
    for (const p of pls) {
      out.push(p);
      out.push(sum - p);
    }
    pls = out;
  }
  return pls;
}

export function simulateTournament(
  moodMods: Record<string, number> = {}
): SimResult {
  const teamMap: Record<string, Team> = Object.fromEntries(
    TEAMS.map((t) => [t.id, t])
  );
  const stageReached: Record<string, Stage> = {};
  for (const t of TEAMS) stageReached[t.id] = "group";
  const matches: MatchResult[] = [];

  // ===== 小组赛 =====
  const winners: Team[] = []; // 12 组头名
  const runnersUp: Team[] = []; // 12 组次名
  const thirds: GroupStanding[] = []; // 12 组第三

  for (const g of GROUPS) {
    const teams = teamsInGroup(g);
    const rows: Record<string, GroupStanding> = {};
    for (const t of teams) rows[t.id] = { team: t, pts: 0, gf: 0, ga: 0 };

    // 单循环 6 场
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const a = teams[i];
        const b = teams[j];
        const m = simulateMatch(a, b, false, moodMods);
        rows[a.id].gf += m.scoreA;
        rows[a.id].ga += m.scoreB;
        rows[b.id].gf += m.scoreB;
        rows[b.id].ga += m.scoreA;
        if (m.scoreA > m.scoreB) rows[a.id].pts += 3;
        else if (m.scoreA < m.scoreB) rows[b.id].pts += 3;
        else {
          rows[a.id].pts += 1;
          rows[b.id].pts += 1;
        }
      }
    }
    const sorted = sortStandings(Object.values(rows));
    winners.push(sorted[0].team);
    runnersUp.push(sorted[1].team);
    thirds.push(sorted[2]);
    stageReached[sorted[0].team.id] = "r32";
    stageReached[sorted[1].team.id] = "r32";
  }

  // 8 个成绩最好的第三名
  const bestThirds = sortStandings(thirds).slice(0, 8).map((r) => r.team);
  for (const t of bestThirds) stageReached[t.id] = "r32";

  // 32 强：12 头名 + 12 次名 + 8 第三名
  const r32teams = [...winners, ...runnersUp, ...bestThirds];
  // 按战力排序后按种子对阵表排位
  const seeded = [...r32teams].sort(
    (a, b) => teamStrength(b, moodMods[b.id]) - teamStrength(a, moodMods[a.id])
  );
  const order = seedOrder(32);
  const bracket = order.map((seed) => seeded[seed - 1]);

  // ===== 淘汰赛 =====
  let round = bracket;
  const stages: Stage[] = ["r16", "qf", "sf", "final", "champion"];
  let roundIdx = 0;

  while (round.length > 1) {
    const next: Team[] = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i];
      const b = round[i + 1];
      const m = simulateMatch(a, b, true, moodMods);
      const winner = teamMap[m.winner];
      next.push(winner);
      stageReached[winner.id] = stages[roundIdx];
      const stageName: Stage =
        round.length === 32
          ? "r32"
          : round.length === 16
          ? "r16"
          : round.length === 8
          ? "qf"
          : round.length === 4
          ? "sf"
          : "final";
      matches.push({
        teamA: a.id,
        teamB: b.id,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        winner: m.winner,
        stage: stageName,
        wentToPenalties: m.wentToPenalties,
      });
    }
    round = next;
    roundIdx++;
  }

  const champion = round[0];
  const runnerUp = matches.find((m) => m.stage === "final");
  stageReached[champion.id] = "champion";

  return {
    champion: champion.id,
    runnerUp: runnerUp
      ? runnerUp.winner === champion.id
        ? runnerUp.teamA === champion.id
          ? runnerUp.teamB
          : runnerUp.teamA
        : runnerUp.winner
      : "",
    stageReached,
    matches,
  };
}
