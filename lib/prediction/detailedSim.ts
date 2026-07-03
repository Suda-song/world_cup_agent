import type { Team, Stage, MatchResult, PlayStyle } from "../types";
import { TEAMS } from "../data/teams";
import { teamsInGroup, GROUPS } from "../data/loader";
import { simulateMatch, expectedGoals, styleClash } from "./poisson";
import { teamStrength, effectiveElo, eloWinProb, penaltyWinProb } from "./elo";
import { predictMatchup } from "./poisson";

// 每场比赛的推理链路
export interface MatchReasoning {
  matchId: string;
  stage: Stage;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  wentToPenalties?: boolean;
  // 推理因子
  eloA: number;
  eloB: number;
  eloDiff: number;
  eloWinProbA: number;
  strengthA: number;
  strengthB: number;
  lambdaA: number; // A期望进球
  lambdaB: number; // B期望进球
  styleClashA: number; // A的球风修正
  styleClashB: number;
  styleA: PlayStyle;
  styleB: PlayStyle;
  moodModA: number;
  moodModB: number;
  hostBoostA: boolean;
  hostBoostB: boolean;
  // 文字推理
  reasoningSteps: string[];
  // 预测概率
  probWinA: number;
  probDraw: number;
  probWinB: number;
}

export interface GroupResult {
  group: string;
  standings: {
    team: Team;
    pts: number;
    gf: number;
    ga: number;
    gd: number;
    qualified: "winner" | "runnerUp" | "third" | null;
  }[];
}

export interface DetailedSimResult {
  champion: string;
  runnerUp: string;
  groupStage: GroupResult[];
  knockout: MatchReasoning[];
  championPath: MatchReasoning[]; // 冠军晋级路径
}

function sortStandings(rows: { team: Team; pts: number; gf: number; ga: number }[]) {
  return rows.sort(
    (a, b) =>
      b.pts - a.pts ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf
  );
}

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

const STYLE_LABEL: Record<PlayStyle, string> = {
  possession: "控球",
  counter: "反击",
  press: "高压",
  defensive: "防守",
  balanced: "均衡",
};

function buildReasoning(
  a: Team,
  b: Team,
  stage: Stage,
  sim: { scoreA: number; scoreB: number; winner: string; wentToPenalties?: boolean },
  moodMods: Record<string, number>
): MatchReasoning {
  const modA = moodMods[a.id] ?? 1;
  const modB = moodMods[b.id] ?? 1;
  const eA = effectiveElo(a);
  const eB = effectiveElo(b);
  const lambdaA = expectedGoals(a, b, modA, modB);
  const lambdaB = expectedGoals(b, a, modB, modA);
  const [scA, scB] = styleClash(a.style, b.style);
  const pred = predictMatchup(a, b, moodMods);

  const steps: string[] = [];

  // Step 1: Elo
  steps.push(
    `Elo评分：${a.name} ${eA} vs ${b.name} ${eB}（差值 ${Math.abs(eA - eB).toFixed(0)}），` +
      `${eA > eB ? a.name : b.name}基础胜率 ${(Math.max(eloWinProb(eA, eB), 1 - eloWinProb(eA, eB)) * 100).toFixed(1)}%`
  );

  // Step 2: 综合战力
  const sA = teamStrength(a, modA);
  const sB = teamStrength(b, modB);
  steps.push(
    `综合战力：${a.name} ${sA.toFixed(1)} vs ${b.name} ${sB.toFixed(1)}（攻防中场速度经验状态六维加权）`
  );

  // Step 3: 泊松期望进球
  steps.push(
    `泊松期望进球：${a.name} λ=${lambdaA.toFixed(2)}，${b.name} λ=${lambdaB.toFixed(2)}（进攻/防守比值×状态×主场）`
  );

  // Step 4: 球风克制
  if (scA !== 1 || scB !== 1) {
    const who = scA > 1 ? a.name : scB > 1 ? b.name : "";
    const victim = scA > 1 ? b.name : a.name;
    if (who) {
      steps.push(
        `战术克制：${who}（${STYLE_LABEL[a.style]}）${scA > 1 || scB > 1 ? "克制" : "被克制"}${victim}（${STYLE_LABEL[b.style]}），进攻效率修正 ×${(scA > 1 ? scA : scB).toFixed(2)}`
      );
    }
  } else {
    steps.push(`战术风格：${a.name}（${STYLE_LABEL[a.style]}）vs ${b.name}（${STYLE_LABEL[b.style]}），风格相容无明显克制`);
  }

  // Step 5: 心情修正
  if (modA !== 1 || modB !== 1) {
    steps.push(
      `球员心情修正：${a.name} ×${modA.toFixed(3)}，${b.name} ×${modB.toFixed(3)}（信心/动机/压力/疲劳四维模型）`
    );
  }

  // Step 6: 主场
  if (a.isHost || b.isHost) {
    const host = a.isHost ? a.name : b.name;
    steps.push(`主场优势：${host} 作为东道主获得 Elo+65 与进球 ×1.12 加成`);
  }

  // Step 7: 结果
  if (sim.wentToPenalties) {
    steps.push(
      `预测比分 ${sim.scoreA}-${sim.scoreB}（点球大战），${sim.winner === a.id ? a.name : b.name}通过点球晋级`
    );
  } else {
    steps.push(
      `预测比分 ${sim.scoreA}-${sim.scoreB}，${sim.winner === a.id ? a.name : b.name}晋级`
    );
  }

  return {
    matchId: `${stage}-${a.id}-${b.id}`,
    stage,
    teamA: a.id,
    teamB: b.id,
    scoreA: sim.scoreA,
    scoreB: sim.scoreB,
    winner: sim.winner,
    wentToPenalties: sim.wentToPenalties,
    eloA: eA,
    eloB: eB,
    eloDiff: eA - eB,
    eloWinProbA: eloWinProb(eA, eB),
    strengthA: sA,
    strengthB: sB,
    lambdaA,
    lambdaB,
    styleClashA: scA,
    styleClashB: scB,
    styleA: a.style,
    styleB: b.style,
    moodModA: modA,
    moodModB: modB,
    hostBoostA: !!a.isHost,
    hostBoostB: !!b.isHost,
    reasoningSteps: steps,
    probWinA: pred.winA,
    probDraw: pred.draw,
    probWinB: pred.winB,
  };
}

export function simulateDetailedTournament(
  moodMods: Record<string, number> = {}
): DetailedSimResult {
  const teamMap: Record<string, Team> = Object.fromEntries(
    TEAMS.map((t) => [t.id, t])
  );

  // ===== 小组赛 =====
  const groupResults: GroupResult[] = [];
  const winners: Team[] = [];
  const runnersUp: Team[] = [];
  const thirds: { team: Team; pts: number; gf: number; ga: number }[] = [];

  for (const g of GROUPS) {
    const teams = teamsInGroup(g);
    const rows = teams.map((t) => ({ team: t, pts: 0, gf: 0, ga: 0 }));

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const a = teams[i];
        const b = teams[j];
        const m = simulateMatch(a, b, false, moodMods);
        rows[i].gf += m.scoreA;
        rows[i].ga += m.scoreB;
        rows[j].gf += m.scoreB;
        rows[j].ga += m.scoreA;
        if (m.scoreA > m.scoreB) rows[i].pts += 3;
        else if (m.scoreA < m.scoreB) rows[j].pts += 3;
        else {
          rows[i].pts += 1;
          rows[j].pts += 1;
        }
      }
    }

    const sorted = sortStandings(rows);
    winners.push(sorted[0].team);
    runnersUp.push(sorted[1].team);
    thirds.push(sorted[2]);

    groupResults.push({
      group: g,
      standings: sorted.map((r, idx) => ({
        team: r.team,
        pts: r.pts,
        gf: r.gf,
        ga: r.ga,
        gd: r.gf - r.ga,
        qualified:
          idx === 0 ? "winner" : idx === 1 ? "runnerUp" : idx === 2 ? "third" : null,
      })),
    });
  }

  // 8 个成绩最好的第三名
  const bestThirds = sortStandings(thirds).slice(0, 8).map((r) => r.team);

  // 32 强对阵
  const r32teams = [...winners, ...runnersUp, ...bestThirds];
  const seeded = [...r32teams].sort(
    (a, b) => teamStrength(b, moodMods[b.id]) - teamStrength(a, moodMods[a.id])
  );
  const order = seedOrder(32);
  const bracket = order.map((seed) => seeded[seed - 1]);

  // ===== 淘汰赛 =====
  const knockoutMatches: MatchReasoning[] = [];
  let round = bracket;
  const stageNames: { round: number; stage: Stage }[] = [
    { round: 32, stage: "r32" },
    { round: 16, stage: "r16" },
    { round: 8, stage: "qf" },
    { round: 4, stage: "sf" },
    { round: 2, stage: "final" },
  ];

  for (const { round: roundSize, stage } of stageNames) {
    const next: Team[] = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i];
      const b = round[i + 1];
      const m = simulateMatch(a, b, true, moodMods);
      const winner = teamMap[m.winner];
      next.push(winner);

      knockoutMatches.push(
        buildReasoning(a, b, stage, m, moodMods)
      );
    }
    round = next;
  }

  const champion = round[0];
  const finalMatch = knockoutMatches.find((m) => m.stage === "final")!;
  const runnerUp =
    finalMatch.winner === champion.id
      ? finalMatch.teamA === champion.id
        ? finalMatch.teamB
        : finalMatch.teamA
      : finalMatch.winner;

  // 冠军晋级路径（淘汰赛）
  const championPath = knockoutMatches.filter(
    (m) => m.teamA === champion.id || m.teamB === champion.id
  );

  return {
    champion: champion.id,
    runnerUp,
    groupStage: groupResults,
    knockout: knockoutMatches,
    championPath,
  };
}
