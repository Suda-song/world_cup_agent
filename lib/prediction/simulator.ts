import type { Team, Stage, MatchResult, LiveTournamentContext, KnownMatchResult } from "../types";
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

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("-");
}

function matchKey(stage: Stage | string, a: string, b: string): string {
  return `${stage}:${pairKey(a, b)}`;
}

function isFinished(r: KnownMatchResult): boolean {
  return r.status === "FINISHED" && !!r.winner && r.scoreA !== null && r.scoreB !== null;
}

function resolveKnownMatch(
  stage: Stage,
  a: Team,
  b: Team,
  knownMatches: Map<string, KnownMatchResult>,
  isKnockout: boolean,
  moodMods: Record<string, number>,
): { scoreA: number; scoreB: number; winner: string; wentToPenalties?: boolean } {
  const known = knownMatches.get(matchKey(stage, a.id, b.id));
  if (known && isFinished(known)) {
    const flipped = known.teamA === b.id;
    return flipped
      ? {
          scoreA: known.scoreB!,
          scoreB: known.scoreA!,
          winner: known.winner!,
          wentToPenalties: known.wentToPenalties,
        }
      : {
          scoreA: known.scoreA!,
          scoreB: known.scoreB!,
          winner: known.winner!,
          wentToPenalties: known.wentToPenalties,
        };
  }

  return simulateMatch(a, b, isKnockout, moodMods);
}

function buildPairsFromMatches(
  stage: Stage,
  liveContext: LiveTournamentContext | undefined,
  teamMap: Record<string, Team>,
): [Team, Team][] | null {
  const live = liveContext?.knockoutMatches?.filter((m) => m.stage === stage) ?? [];
  if (live.length === 0) return null;

  const pairs: [Team, Team][] = [];
  for (const m of live) {
    const a = teamMap[m.teamA];
    const b = teamMap[m.teamB];
    if (a && b) pairs.push([a, b]);
  }

  return pairs.length > 0 ? pairs : null;
}

function buildPairsFromWinners(prevWinners: Team[]): [Team, Team][] {
  const pairs: [Team, Team][] = [];
  for (let i = 0; i < prevWinners.length; i += 2) {
    if (prevWinners[i] && prevWinners[i + 1]) pairs.push([prevWinners[i], prevWinners[i + 1]]);
  }
  return pairs;
}

function fillMissingPairs(livePairs: [Team, Team][], fallbackTeams: Team[], expectedCount: number): [Team, Team][] {
  if (livePairs.length >= expectedCount) return livePairs;

  const knownTeamIds = new Set(livePairs.flatMap(([a, b]) => [a.id, b.id]));
  const remaining = fallbackTeams.filter((t) => !knownTeamIds.has(t.id));
  return [...livePairs, ...buildPairsFromWinners(remaining)].slice(0, expectedCount);
}

export function simulateTournament(
  moodMods: Record<string, number> = {},
  liveContext?: LiveTournamentContext,
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

  const groupLive = liveContext?.groupMatches ?? [];
  const knockoutLive = liveContext?.knockoutMatches ?? [];
  const knownMatches = new Map<string, KnownMatchResult>();
  for (const r of [...groupLive, ...knockoutLive]) {
    knownMatches.set(matchKey(r.stage, r.teamA, r.teamB), r);
  }

  const groupLiveByGroup: Record<string, KnownMatchResult[]> = {};
  for (const r of groupLive) {
    const group = r.group ?? teamMap[r.teamA]?.group ?? teamMap[r.teamB]?.group;
    if (group) (groupLiveByGroup[group] ||= []).push(r);
  }

  for (const g of GROUPS) {
    const liveGroupMatches = groupLiveByGroup[g] ?? [];
    const liveTeamIds = [...new Set(liveGroupMatches.flatMap((m) => [m.teamA, m.teamB]))]
      .filter((id) => !!teamMap[id]);
    const teams =
      liveTeamIds.length >= 4
        ? liveTeamIds.map((id) => teamMap[id])
        : [...teamsInGroup(g), ...liveTeamIds.map((id) => teamMap[id])]
            .filter((team, idx, arr): team is Team => !!team && arr.findIndex((t) => t?.id === team.id) === idx);
    const rows: Record<string, GroupStanding> = {};
    for (const t of teams) rows[t.id] = { team: t, pts: 0, gf: 0, ga: 0 };

    const playedPairs = new Set<string>();
    for (const m of liveGroupMatches) {
      const a = teamMap[m.teamA];
      const b = teamMap[m.teamB];
      if (!a || !b || !rows[a.id] || !rows[b.id]) continue;
      playedPairs.add(pairKey(a.id, b.id));
      const result = resolveKnownMatch("group", a, b, knownMatches, false, moodMods);
      rows[a.id].gf += result.scoreA;
      rows[a.id].ga += result.scoreB;
      rows[b.id].gf += result.scoreB;
      rows[b.id].ga += result.scoreA;
      if (result.scoreA > result.scoreB) rows[a.id].pts += 3;
      else if (result.scoreA < result.scoreB) rows[b.id].pts += 3;
      else {
        rows[a.id].pts += 1;
        rows[b.id].pts += 1;
      }
    }

    // 单循环 6 场；接口已给出的场次不重复模拟
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const a = teams[i];
        const b = teams[j];
        if (playedPairs.has(pairKey(a.id, b.id))) continue;
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
  function runStage(stageName: Stage, pairs: [Team, Team][], nextStage: Stage): Team[] {
    const next: Team[] = [];
    for (const [a, b] of pairs) {
      const m = resolveKnownMatch(stageName, a, b, knownMatches, true, moodMods);
      const winner = teamMap[m.winner];
      if (!winner) continue;
      next.push(winner);
      stageReached[winner.id] = nextStage;
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
    return next;
  }

  const liveR32Pairs = buildPairsFromMatches("r32", liveContext, teamMap);
  const r32Pairs = liveR32Pairs ? fillMissingPairs(liveR32Pairs, bracket, 16) : buildPairsFromWinners(bracket);
  const r32Winners = runStage("r32", r32Pairs, "r16");
  const liveR16Pairs = buildPairsFromMatches("r16", liveContext, teamMap);
  const r16Pairs = liveR16Pairs ? fillMissingPairs(liveR16Pairs, r32Winners, 8) : buildPairsFromWinners(r32Winners);
  const r16Winners = runStage("r16", r16Pairs, "qf");
  const liveQfPairs = buildPairsFromMatches("qf", liveContext, teamMap);
  const qfPairs = liveQfPairs ? fillMissingPairs(liveQfPairs, r16Winners, 4) : buildPairsFromWinners(r16Winners);
  const qfWinners = runStage("qf", qfPairs, "sf");
  const liveSfPairs = buildPairsFromMatches("sf", liveContext, teamMap);
  const sfPairs = liveSfPairs ? fillMissingPairs(liveSfPairs, qfWinners, 2) : buildPairsFromWinners(qfWinners);
  const sfWinners = runStage("sf", sfPairs, "final");
  const liveFinalPairs = buildPairsFromMatches("final", liveContext, teamMap);
  const finalPairs = liveFinalPairs ? fillMissingPairs(liveFinalPairs, sfWinners, 1) : buildPairsFromWinners(sfWinners);
  const finalWinners = runStage("final", finalPairs, "champion");

  const champion = finalWinners[0];
  const runnerUp = matches.find((m) => m.stage === "final");
  if (champion) stageReached[champion.id] = "champion";

  return {
    champion: champion?.id ?? "",
    runnerUp: runnerUp
      ? runnerUp.winner === champion?.id
        ? runnerUp.teamA === champion?.id
          ? runnerUp.teamB
          : runnerUp.teamA
        : runnerUp.winner
      : "",
    stageReached,
    matches,
  };
}
