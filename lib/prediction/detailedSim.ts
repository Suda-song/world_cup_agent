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
  // 是否为真实已完成比赛
  isReal: boolean;
  // 比赛三态：finished=真实已完成 | confirmed=对手已定待踢 | pending=对手未定
  matchState: "finished" | "confirmed" | "pending";
}

export interface GroupResult {
  group: string;
  isReal: boolean;  // 该组积分数据是否来自真实比赛结果
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
  moodMods: Record<string, number>,
  isReal = false,
  matchState: "finished" | "confirmed" | "pending" = "pending"
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

  if (isReal) {
    // 真实已完成比赛：先说明结果来源，再附上模型分析作为参考
    const winnerName = sim.winner === a.id ? a.name : b.name;
    const loserName = sim.winner === a.id ? b.name : a.name;
    steps.push(
      `✅ 真实比赛结果（数据来源：football-data.org）：${winnerName} ${sim.scoreA}-${sim.scoreB} ${loserName}${sim.wentToPenalties ? "（点球大战）" : ""}，${winnerName}晋级`
    );
    steps.push(`── 以下为模型事前预测分析（仅供参考）──`);
  }

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
  if (matchState === "finished") {
    // 真实结果已在顶部显示，此处不重复
  } else if (matchState === "confirmed") {
    // 对手已定，尚未开球
    steps.push(
      `📅 对阵已确认，比赛尚未开始。模型预测比分 ${sim.scoreA}-${sim.scoreB}${sim.wentToPenalties ? "（点球大战）" : ""}，${sim.winner === a.id ? a.name : b.name}晋级`
    );
  } else {
    // 对手待定（上一轮未出线）
    steps.push(
      `🔮 对手待定（需上一轮比赛结束后确认）。假设对阵后模型预测比分 ${sim.scoreA}-${sim.scoreB}${sim.wentToPenalties ? "（点球大战）" : ""}，${sim.winner === a.id ? a.name : b.name}晋级`
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
    isReal,
    matchState,
  };
}

// 来自 football-data.org 的比赛记录（已完成 or 未完成）
export interface KnownMatchResult {
  teamA: string;
  teamB: string;
  scoreA: number | null;   // null = 未完成
  scoreB: number | null;
  winner: string | null;   // null = 未完成
  wentToPenalties: boolean;
  stage: string;
  status: string;          // FINISHED | SCHEDULED | LIVE 等
  matchState: "finished" | "confirmed" | "pending";
  group?: string;          // 仅小组赛：所属组别字母，如 "A"
}

export function simulateDetailedTournament(
  moodMods: Record<string, number> = {},
  knockoutLive: KnownMatchResult[] = [],   // 淘汰赛场次（含未完成）
  groupLive: KnownMatchResult[] = [],      // 小组赛已完成场次
): DetailedSimResult {
  const teamMap: Record<string, Team> = Object.fromEntries(
    TEAMS.map((t) => [t.id, t])
  );

  // 已完成比赛索引（双向），同时覆盖淘汰赛和小组赛
  const allFinished = [...knockoutLive, ...groupLive].filter(
    (r) => r.status === "FINISHED" && r.winner
  );
  const finishedMap = new Map<string, KnownMatchResult>();
  for (const r of allFinished) {
    finishedMap.set(`${r.teamA}-${r.teamB}`, r);
    finishedMap.set(`${r.teamB}-${r.teamA}`, r);
  }

  // 淘汰赛按 stage 分组（含未完成），用于重建 bracket
  const liveByStage: Record<string, KnownMatchResult[]> = {};
  for (const r of knockoutLive) {
    (liveByStage[r.stage] ||= []).push(r);
  }

  // 对某场比赛：已完成用真实结果，否则模型预测
  // 淘汰赛 confirmed 对阵 set（对手已定但未踢）
  const confirmedPairSet = new Set<string>();
  for (const r of knockoutLive) {
    if (r.matchState === "confirmed") {
      confirmedPairSet.add(`${r.teamA}-${r.teamB}`);
      confirmedPairSet.add(`${r.teamB}-${r.teamA}`);
    }
  }

  function resolveMatch(
    a: Team,
    b: Team,
    isKnockout = true,
  ): { scoreA: number; scoreB: number; winner: string; wentToPenalties?: boolean; isReal: boolean; matchState: "finished" | "confirmed" | "pending" } {
    const known = finishedMap.get(`${a.id}-${b.id}`) ?? finishedMap.get(`${b.id}-${a.id}`);
    if (known && known.winner && known.scoreA !== null && known.scoreB !== null) {
      const flipped = known.teamA === b.id;
      return flipped
        ? { scoreA: known.scoreB!, scoreB: known.scoreA!, winner: known.winner, wentToPenalties: known.wentToPenalties, isReal: true, matchState: "finished" }
        : { scoreA: known.scoreA!, scoreB: known.scoreB!, winner: known.winner, wentToPenalties: known.wentToPenalties, isReal: true, matchState: "finished" };
    }
    // 检查该对阵是否在 API 已公布的 confirmed 对阵中
    const isConfirmed = confirmedPairSet.has(`${a.id}-${b.id}`);
    return { ...simulateMatch(a, b, isKnockout, moodMods), isReal: false, matchState: isConfirmed ? "confirmed" : "pending" };
  }

  // ===== 小组赛 =====
  // 直接从 groupLive 真实比赛数据构建各组积分榜，不依赖种子数据的 group 字段
  const groupResults: GroupResult[] = [];
  const winners: Team[] = [];
  const runnersUp: Team[] = [];
  const thirds: { team: Team; pts: number; gf: number; ga: number }[] = [];

  if (groupLive.length > 0) {
    // 按真实组别分组
    const realGroupMap: Record<string, KnownMatchResult[]> = {};
    for (const m of groupLive) {
      const g = m.group ?? "?";
      (realGroupMap[g] ||= []).push(m);
    }

    for (const g of Object.keys(realGroupMap).sort()) {
      const matches = realGroupMap[g];
      // 收集该组所有球队
      const teamIdSet = new Set<string>();
      for (const m of matches) {
        teamIdSet.add(m.teamA);
        teamIdSet.add(m.teamB);
      }
      const teams = [...teamIdSet].map((id) => teamMap[id]).filter(Boolean);
      const rows = teams.map((t) => ({ team: t, pts: 0, gf: 0, ga: 0 }));

      // 用真实比赛数据计算积分
      for (const m of matches) {
        const iA = teams.findIndex((t) => t.id === m.teamA);
        const iB = teams.findIndex((t) => t.id === m.teamB);
        if (iA === -1 || iB === -1) continue;

        let sA: number, sB: number;
        if (m.status === "FINISHED" && m.scoreA !== null && m.scoreB !== null) {
          sA = m.scoreA; sB = m.scoreB;
        } else {
          // 该场尚未完成，预测
          const sim = simulateMatch(teams[iA], teams[iB], false, moodMods);
          sA = sim.scoreA; sB = sim.scoreB;
        }

        rows[iA].gf += sA; rows[iA].ga += sB;
        rows[iB].gf += sB; rows[iB].ga += sA;
        if (sA > sB) rows[iA].pts += 3;
        else if (sA < sB) rows[iB].pts += 3;
        else { rows[iA].pts += 1; rows[iB].pts += 1; }
      }

      const sorted = sortStandings(rows);
      winners.push(sorted[0].team);
      runnersUp.push(sorted[1].team);
      if (sorted[2]) thirds.push(sorted[2]);

      const allFinishedInGroup = matches.every((m) => m.status === "FINISHED");
      groupResults.push({
        group: g,
        isReal: allFinishedInGroup,
        standings: sorted.map((r, idx) => ({
          team: r.team,
          pts: r.pts,
          gf: r.gf,
          ga: r.ga,
          gd: r.gf - r.ga,
          qualified: idx === 0 ? "winner" : idx === 1 ? "runnerUp" : idx === 2 ? "third" : null,
        })),
      });
    }
  } else {
    // 无真实数据时走原始模拟（按种子数据分组）
    for (const g of GROUPS) {
      const teams = teamsInGroup(g);
      const rows = teams.map((t) => ({ team: t, pts: 0, gf: 0, ga: 0 }));
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          const sim = simulateMatch(teams[i], teams[j], false, moodMods);
          rows[i].gf += sim.scoreA; rows[i].ga += sim.scoreB;
          rows[j].gf += sim.scoreB; rows[j].ga += sim.scoreA;
          if (sim.scoreA > sim.scoreB) rows[i].pts += 3;
          else if (sim.scoreA < sim.scoreB) rows[j].pts += 3;
          else { rows[i].pts += 1; rows[j].pts += 1; }
        }
      }
      const sorted = sortStandings(rows);
      winners.push(sorted[0].team);
      runnersUp.push(sorted[1].team);
      if (sorted[2]) thirds.push(sorted[2]);
      groupResults.push({
        group: g,
        isReal: false,
        standings: sorted.map((r, idx) => ({
          team: r.team, pts: r.pts, gf: r.gf, ga: r.ga, gd: r.gf - r.ga,
          qualified: idx === 0 ? "winner" : idx === 1 ? "runnerUp" : idx === 2 ? "third" : null,
        })),
      });
    }
  }

  // 8 个成绩最好的第三名
  const bestThirds = sortStandings(thirds).slice(0, 8).map((r) => r.team);

  // ===== 淘汰赛 =====
  // 策略：每个阶段优先用 API 返回的真实对阵（含未完成），没有则从上一轮胜者推导
  const knockoutMatches: MatchReasoning[] = [];

  /**
   * 将某阶段所有对阵（pairs）跑完，返回胜者列表。
   * 已完成场次用真实结果，未完成的走泊松预测。
   */
  function runStage(
    stage: Stage,
    pairs: [Team, Team][],
  ): Team[] {
    const stageWinners: Team[] = [];
    for (const [a, b] of pairs) {
      const m = resolveMatch(a, b);
      const winner = teamMap[m.winner];
      stageWinners.push(winner);
      knockoutMatches.push(buildReasoning(a, b, stage, m, moodMods, m.isReal, m.matchState));
    }
    return stageWinners;
  }

  /**
   * 从 API 真实对阵构建 pairs（按发布顺序）。
   * 如果该阶段没有真实对阵，返回 null。
   */
  function buildPairsFromLive(stage: Stage): [Team, Team][] | null {
    const live = liveByStage[stage] ?? [];
    if (live.length === 0) return null;
    const pairs: [Team, Team][] = [];
    for (const m of live) {
      const tA = teamMap[m.teamA];
      const tB = teamMap[m.teamB];
      if (tA && tB) pairs.push([tA, tB]);
    }
    return pairs.length > 0 ? pairs : null;
  }

  /**
   * 从上一轮胜者列表构建 pairs（顺序配对）。
   */
  function buildPairsFromWinners(prevWinners: Team[]): [Team, Team][] {
    const pairs: [Team, Team][] = [];
    for (let i = 0; i < prevWinners.length; i += 2) {
      pairs.push([prevWinners[i], prevWinners[i + 1]]);
    }
    return pairs;
  }

  // r32 初始 bracket：优先 API 真实对阵，否则种子排位
  let r32Pairs = buildPairsFromLive("r32");
  if (!r32Pairs) {
    const r32teams = [...winners, ...runnersUp, ...bestThirds];
    const seeded = [...r32teams].sort(
      (a, b) => teamStrength(b, moodMods[b.id]) - teamStrength(a, moodMods[a.id])
    );
    const order = seedOrder(32);
    const bracket = order.map((seed) => seeded[seed - 1]);
    r32Pairs = buildPairsFromWinners(bracket);
  }

  const r32Winners = runStage("r32", r32Pairs);

  // r16：优先 API 真实对阵；若只有部分（如 5/8），其余由 r32 胜者补充
  let r16Pairs = buildPairsFromLive("r16");
  if (!r16Pairs) {
    r16Pairs = buildPairsFromWinners(r32Winners);
  } else if (r16Pairs.length < 8) {
    // 部分已知：用 r32 胜者中未出现在已知对阵里的队来补充
    const knownTeamIds = new Set(r16Pairs.flatMap(([a, b]) => [a.id, b.id]));
    const remaining = r32Winners.filter((t) => !knownTeamIds.has(t.id));
    for (let i = 0; i < remaining.length; i += 2) {
      r16Pairs.push([remaining[i], remaining[i + 1]]);
    }
  }
  const r16Winners = runStage("r16", r16Pairs);

  // qf / sf / final 同理
  const qfPairs = buildPairsFromLive("qf") ?? buildPairsFromWinners(r16Winners);
  const qfWinners = runStage("qf", qfPairs);

  const sfPairs = buildPairsFromLive("sf") ?? buildPairsFromWinners(qfWinners);
  const sfWinners = runStage("sf", sfPairs);

  const finalPairs = buildPairsFromLive("final") ?? buildPairsFromWinners(sfWinners);
  const finalWinners = runStage("final", finalPairs);

  const champion = finalWinners[0];
  const finalMatch = knockoutMatches.find((m) => m.stage === "final")!;
  const runnerUp =
    finalMatch.teamA === champion.id ? finalMatch.teamB : finalMatch.teamA;

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
