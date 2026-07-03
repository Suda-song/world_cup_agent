import type { Team, PlayStyle } from "../types";
import { TEAMS, TEAM_MAP } from "../data/teams";
import { HISTORY } from "../data/history";
import { teamStrength } from "../prediction/elo";

export type Dimension =
  | "strength"
  | "complement"
  | "style"
  | "history"
  | "group"
  | "confederation";

export const DIMENSIONS: { key: Dimension; label: string; color: string; desc: string }[] = [
  { key: "strength", label: "实力相近", color: "#22c55e", desc: "Elo 接近的球队" },
  { key: "complement", label: "攻防互补", color: "#38bdf8", desc: "一队强攻一队强守" },
  { key: "style", label: "风格相似", color: "#fbbf24", desc: "相同战术体系" },
  { key: "history", label: "历史交锋", color: "#f97316", desc: "有经典对阵记录" },
  { key: "group", label: "同组对手", color: "#ef4444", desc: "同处小组赛一组" },
  { key: "confederation", label: "同洲", color: "#a78bfa", desc: "属同一足联" },
];

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
  dimension: Dimension;
}

const strengthMap: Record<string, number> = {};
for (const t of TEAMS) strengthMap[t.id] = teamStrength(t);

// 计算所有球队两两间在某维度上的边
export function computeEdges(dims: Dimension[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const dimSet = new Set(dims);
  const seen = new Set<string>();

  for (let i = 0; i < TEAMS.length; i++) {
    for (let j = i + 1; j < TEAMS.length; j++) {
      const a = TEAMS[i];
      const b = TEAMS[j];
      const rels = relationBetween(a, b);
      for (const r of rels) {
        if (!dimSet.has(r.dimension)) continue;
        const key = `${r.dimension}:${a.id}-${b.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({
          id: key,
          source: a.id,
          target: b.id,
          label: r.label,
          weight: r.weight,
          dimension: r.dimension,
        });
      }
    }
  }
  return edges;
}

function relationBetween(
  a: Team,
  b: Team
): { dimension: Dimension; weight: number; label: string }[] {
  const out: { dimension: Dimension; weight: number; label: string }[] = [];

  // 实力相近
  const dElo = Math.abs(a.elo - b.elo);
  if (dElo < 120) {
    out.push({
      dimension: "strength",
      weight: Math.max(0.3, 1 - dElo / 120),
      label: `ΔElo ${dElo}`,
    });
  }

  // 攻防互补：一队进攻强 + 另一队防守强
  const comp1 = (a.ratings.attack - 65) * (b.ratings.defense - 65);
  const comp2 = (b.ratings.attack - 65) * (a.ratings.defense - 65);
  const comp = Math.max(comp1, comp2);
  if (comp > 200) {
    out.push({
      dimension: "complement",
      weight: Math.min(1, comp / 600),
      label: "攻守互补",
    });
  }

  // 风格相似
  if (a.style === b.style) {
    out.push({ dimension: "style", weight: 0.8, label: styleLabel(a.style) });
  }

  // 历史交锋
  const h = HISTORY.find(
    (x) =>
      (x.teamA === a.id && x.teamB === b.id) ||
      (x.teamA === b.id && x.teamB === a.id)
  );
  if (h) {
    out.push({
      dimension: "history",
      weight: Math.min(1, h.played / 50),
      label: `${h.played}场`,
    });
  }

  // 同组
  if (a.group === b.group) {
    out.push({ dimension: "group", weight: 1, label: `${a.group}组` });
  }

  // 同洲
  if (a.confederation === b.confederation) {
    out.push({ dimension: "confederation", weight: 0.5, label: a.confederation });
  }

  return out;
}

export function graphNodes() {
  return TEAMS.map((t) => ({
    id: t.id,
    label: `${t.flag} ${t.name}`,
    data: { elo: t.elo, strength: strengthMap[t.id], conf: t.confederation, style: t.style },
  }));
}

// 统计：最强关系对、最克制关系（攻防互补代表克制）、孤立球队
export function graphStats(dims: Dimension[]) {
  const edges = computeEdges(dims);
  const degree: Record<string, number> = {};
  for (const t of TEAMS) degree[t.id] = 0;
  for (const e of edges) {
    degree[e.source]++;
    degree[e.target]++;
  }
  const strongest = [...edges].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const isolated = TEAMS.filter((t) => degree[t.id] === 0).map((t) => t.name);
  // 最克制：complement 维度里最强
  const counterEdges = edges
    .filter((e) => e.dimension === "complement")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  return { strongest, counterEdges, isolated, totalEdges: edges.length };
}

export function styleLabel(s: PlayStyle): string {
  const m: Record<PlayStyle, string> = {
    possession: "控球",
    counter: "反击",
    press: "高压",
    defensive: "防守",
    balanced: "均衡",
  };
  return m[s];
}

export { TEAM_MAP };
