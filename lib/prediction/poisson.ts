import type { Team, PlayStyle, MatchupPrediction } from "../types";
import { teamStrength, effectiveElo, penaltyWinProb } from "./elo";

// 泊松采样
export function samplePoisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// 球风克制系数：返回 [modA, modB] 对期望进球的乘数
// counter 克 possession；press 克 possession（较小）；defensive 克 counter
export function styleClash(a: PlayStyle, b: PlayStyle): [number, number] {
  const mod = (sa: PlayStyle, sb: PlayStyle): number => {
    if (sa === "counter" && sb === "possession") return 1.18;
    if (sa === "press" && sb === "possession") return 1.08;
    if (sa === "defensive" && sb === "counter") return 0.82; // 削弱对方
    if (sa === "possession" && sb === "defensive") return 0.92;
    return 1;
  };
  // modA 影响 A 进攻 vs B；同时 B 风格影响 A
  let aAtk = 1;
  let bAtk = 1;
  aAtk *= mod(a, b);
  bAtk *= mod(b, a);
  // defensive 自身进攻削弱
  if (a === "defensive") aAtk *= 0.9;
  if (b === "defensive") bAtk *= 0.9;
  return [aAtk, bAtk];
}

// 期望进球 λ
export function expectedGoals(
  attacker: Team,
  defender: Team,
  moodModA = 1,
  moodModB = 1
): number {
  const [aAtk] = styleClash(attacker.style, defender.style);
  const atk = attacker.ratings.attack * (moodModA ?? 1);
  const def = defender.ratings.defense * (moodModB ?? 1);
  const base = (atk / 100) * ((100 - def) / 100) * 2.6;
  const formBoost = 0.8 + 0.4 * (attacker.ratings.form / 100);
  const hostBoost = attacker.isHost ? 1.12 : 1;
  return Math.max(0.15, base * aAtk * formBoost * hostBoost);
}

export interface SimMatch {
  scoreA: number;
  scoreB: number;
  winner: string; // teamId，平局淘汰赛走点球
  wentToPenalties?: boolean;
}

// 模拟一场比赛
export function simulateMatch(
  a: Team,
  b: Team,
  knockout: boolean,
  moodMods: Record<string, number> = {}
): SimMatch {
  const modA = moodMods[a.id] ?? 1;
  const modB = moodMods[b.id] ?? 1;
  const lambdaA = expectedGoals(a, b, modA, modB);
  const lambdaB = expectedGoals(b, a, modB, modA);
  let scoreA = samplePoisson(lambdaA);
  let scoreB = samplePoisson(lambdaB);

  // 淘汰赛平局 → 点球
  if (knockout && scoreA === scoreB) {
    const p = penaltyWinProb(effectiveElo(a) * modA, effectiveElo(b) * modB);
    const winner = Math.random() < p ? a.id : b.id;
    // 点球获胜方比分 +1，确保比分与胜者一致
    if (winner === a.id) scoreA++;
    else scoreB++;
    return { scoreA, scoreB, winner, wentToPenalties: true };
  }
  const winner = scoreA > scoreB ? a.id : scoreA < scoreB ? b.id : "";
  return { scoreA, scoreB, winner };
}

// 单场预测（不采样，用泊松矩阵求最可能比分与胜平负概率）
export function predictMatchup(
  a: Team,
  b: Team,
  moodMods: Record<string, number> = {}
): MatchupPrediction {
  const modA = moodMods[a.id] ?? 1;
  const modB = moodMods[b.id] ?? 1;
  const lambdaA = expectedGoals(a, b, modA, modB);
  const lambdaB = expectedGoals(b, a, modB, modA);

  let winA = 0,
    draw = 0,
    winB = 0;
  let best = { a: 0, b: 0, prob: 0 };
  const MAX = 7;
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = poissonProb(i, lambdaA) * poissonProb(j, lambdaB);
      if (i > j) winA += p;
      else if (i === j) draw += p;
      else winB += p;
      if (p > best.prob) best = { a: i, b: j, prob: p };
    }
  }
  const total = winA + draw + winB;
  return {
    winA: winA / total,
    draw: draw / total,
    winB: winB / total,
    expectedScoreA: lambdaA,
    expectedScoreB: lambdaB,
    likelyScore: { a: best.a, b: best.b },
  };
}

function poissonProb(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}
function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
