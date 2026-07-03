import type { Team } from "../types";

// Elo 胜率计算：Ea = 1 / (1 + 10^((Rb-Ra)/400))
// 含主场优势与状态修正

export function eloWinProb(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// 综合战力分：融合 Elo 与 6 维评分，返回 0-100 标尺
export function teamStrength(team: Team, moodMod = 1): number {
  const r = team.ratings;
  const baseRating = (r.attack + r.defense + r.midfield) / 3;
  const speedExp = (r.speed + r.experience) / 2;
  // Elo 归一到 0-100（1200~2100 映射 40~95）
  const eloNorm = 40 + ((team.elo - 1200) / 900) * 55;
  const raw = baseRating * 0.45 + eloNorm * 0.35 + speedExp * 0.1 + r.form * 0.1;
  return Math.max(20, Math.min(99, raw * moodMod));
}

// 主场修正：东道主 Elo 加成
export function effectiveElo(team: Team): number {
  return team.elo + (team.isHost ? 65 : 0);
}

// 点球大战胜率（基于 Elo，略向 50% 收敛）
export function penaltyWinProb(eloA: number, eloB: number): number {
  const p = eloWinProb(eloA, eloB);
  return 0.5 + (p - 0.5) * 0.6;
}
