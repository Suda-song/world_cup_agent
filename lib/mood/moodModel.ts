import type { MoodState } from "../types";
import { getPlayersOf } from "../data/loader";

// 心情分 = 0.3×信心 + 0.25×动机 + 0.2×(100-压力) + 0.25×(100-疲劳)
export function moodScore(m: MoodState): number {
  return (
    0.3 * m.confidence +
    0.25 * m.motivation +
    0.2 * (100 - m.pressure) +
    0.25 * (100 - m.fatigue)
  );
}

// 性能修正系数 0.8 ~ 1.2
export function playerPerfMod(m: MoodState): number {
  return 0.8 + 0.4 * (moodScore(m) / 100);
}

// 球队综合心情修正（按球员能力加权聚合，归一到 ~0.88-1.12）
export function teamMoodModifier(teamId: string): number {
  const players = getPlayersOf(teamId);
  if (players.length === 0) return 1;
  let wsum = 0;
  let acc = 0;
  for (const p of players) {
    const w = p.overall;
    acc += playerPerfMod(p.mood) * w;
    wsum += w;
  }
  const avg = wsum > 0 ? acc / wsum : 1;
  return Math.max(0.85, Math.min(1.15, avg));
}

// 球队心情维度聚合（按能力加权）
export function teamMoodBreakdown(teamId: string): MoodState {
  const players = getPlayersOf(teamId);
  const w: MoodState = { pressure: 0, confidence: 0, fatigue: 0, motivation: 0 };
  if (players.length === 0) return { pressure: 50, confidence: 50, fatigue: 50, motivation: 50 };
  let wsum = 0;
  for (const p of players) {
    const weight = p.overall;
    w.pressure += p.mood.pressure * weight;
    w.confidence += p.mood.confidence * weight;
    w.fatigue += p.mood.fatigue * weight;
    w.motivation += p.mood.motivation * weight;
    wsum += weight;
  }
  return {
    pressure: w.pressure / wsum,
    confidence: w.confidence / wsum,
    fatigue: w.fatigue / wsum,
    motivation: w.motivation / wsum,
  };
}

export type MoodEvent =
  | "win"
  | "loss"
  | "draw"
  | "advance" // 晋级
  | "lateStage" // 进入后期(4强+)
  | "rest"; // 休息

// 心情动态演化：晋级+信心/动机，后期+压力，连赛+疲劳
export function evolveMood(m: MoodState, event: MoodEvent): MoodState {
  const next = { ...m };
  switch (event) {
    case "win":
      next.confidence = clamp(next.confidence + 6);
      next.motivation = clamp(next.motivation + 3);
      next.pressure = clamp(next.pressure - 3);
      break;
    case "loss":
      next.confidence = clamp(next.confidence - 8);
      next.motivation = clamp(next.motivation + 4); // 背水一战
      break;
    case "draw":
      next.confidence = clamp(next.confidence - 2);
      break;
    case "advance":
      next.confidence = clamp(next.confidence + 8);
      next.motivation = clamp(next.motivation + 6);
      break;
    case "lateStage":
      next.pressure = clamp(next.pressure + 12);
      next.motivation = clamp(next.motivation + 5);
      break;
    case "rest":
      next.fatigue = clamp(next.fatigue - 15);
      next.confidence = clamp(next.confidence + 2);
      break;
  }
  // 每场比赛自然增加疲劳
  if (event !== "rest") next.fatigue = clamp(next.fatigue + 7);
  return next;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// 心情随赛程推进的演化曲线
export interface MoodPoint {
  stage: string;
  moodScore: number;
  pressure: number;
  confidence: number;
  fatigue: number;
  motivation: number;
}

export function moodEvolutionCurve(teamId: string): MoodPoint[] {
  const players = getPlayersOf(teamId);
  const stages = ["小组赛", "16强", "8强", "4强", "决赛"];
  // 假设一路晋级到决赛的演化
  const events: MoodEvent[] = ["win", "advance", "advance", "lateStage", "lateStage"];
  const points: MoodPoint[] = [];

  // 深拷贝初始心情
  let current = players.map((p) => ({ ...p.mood }));
  const aggregate = (): MoodState => {
    if (current.length === 0)
      return { pressure: 50, confidence: 50, fatigue: 50, motivation: 50 };
    let wsum = 0;
    const w: MoodState = { pressure: 0, confidence: 0, fatigue: 0, motivation: 0 };
    for (let i = 0; i < players.length; i++) {
      const weight = players[i].overall;
      w.pressure += current[i].pressure * weight;
      w.confidence += current[i].confidence * weight;
      w.fatigue += current[i].fatigue * weight;
      w.motivation += current[i].motivation * weight;
      wsum += weight;
    }
    return {
      pressure: w.pressure / wsum,
      confidence: w.confidence / wsum,
      fatigue: w.fatigue / wsum,
      motivation: w.motivation / wsum,
    };
  };

  // 初始点
  const agg0 = aggregate();
  points.push({ stage: "赛前", moodScore: moodScore(agg0), ...agg0 });

  for (let s = 0; s < stages.length; s++) {
    current = current.map((m) => evolveMood(m, events[s]));
    const agg = aggregate();
    points.push({ stage: stages[s], moodScore: moodScore(agg), ...agg });
  }
  return points;
}

export function moodLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "极佳", color: "#22c55e" };
  if (score >= 60) return { label: "良好", color: "#84cc16" };
  if (score >= 45) return { label: "一般", color: "#fbbf24" };
  if (score >= 30) return { label: "低迷", color: "#f97316" };
  return { label: "糟糕", color: "#ef4444" };
}
