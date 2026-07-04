// Data-source config center: user viewpoints that influence the simulation.

export type ViewpointScope = "team" | "general";
export type ViewpointCategory = "tactics" | "form" | "history" | "opinion";
export type ViewpointStance = "positive" | "neutral" | "negative";

export interface Viewpoint {
  id: number;
  scope: ViewpointScope;
  teamId: string | null;
  category: ViewpointCategory;
  stance: ViewpointStance;
  weight: number; // 1-5
  content: string;
  link?: string | null; // 原始帖子链接（如 小红书/微博URL）
  author?: string | null;
  source?: string; // 来源平台：小红书/微博/抖音/知乎/Twitter/其他
  createdAt?: string;
}

// 观点来源平台（方便 DBA 分类抓取与分析）
export const SOURCES = [
  "小红书",
  "微博",
  "抖音",
  "知乎",
  "Twitter/X",
  "其他",
] as const;
export type ViewpointSource = (typeof SOURCES)[number];

export const CATEGORY_LABEL: Record<ViewpointCategory, string> = {
  tactics: "战术打法",
  form: "球员状态/伤病",
  history: "历史交锋",
  opinion: "舆论/数据",
};

export const STANCE_LABEL: Record<ViewpointStance, string> = {
  positive: "利好",
  neutral: "中性",
  negative: "利空",
};

// How strongly each category moves a team's strength (media/opinion counts least).
const CATEGORY_FACTOR: Record<ViewpointCategory, number> = {
  tactics: 0.6,
  form: 0.8,
  history: 0.4,
  opinion: 0.3,
};

const STANCE_SIGN: Record<ViewpointStance, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

// Overall sensitivity + clamp so viewpoints stay in the same ±15% band as mood.
const K = 0.05;
const MIN = 0.85;
const MAX = 1.15;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface SourceConfig {
  source: string;
  weight: number; // 0-3, default 1
  enabled: boolean;
}

// Per-team strength multiplier derived from viewpoints, scaled by DBA source config.
export function computeViewpointMods(
  viewpoints: Viewpoint[],
  teamIds: string[],
  sourceConfig?: SourceConfig[],
): Record<string, number> {
  // Build per-source scale factors from DBA config.
  const sourceScale: Record<string, number> = {};
  if (sourceConfig) {
    for (const sc of sourceConfig) {
      sourceScale[sc.source] = sc.enabled ? clamp(sc.weight, 0, 3) : 0;
    }
  }

  const delta: Record<string, number> = {};
  for (const id of teamIds) delta[id] = 0;

  let generalDelta = 0;
  for (const v of viewpoints) {
    const src = v.source ?? "其他";
    const scale = sourceScale[src] ?? 1; // default 1 when no config loaded
    const contrib =
      scale *
      STANCE_SIGN[v.stance] *
      (clamp(v.weight, 1, 5) / 5) *
      CATEGORY_FACTOR[v.category];
    if (v.scope === "general") {
      generalDelta += contrib;
    } else if (v.teamId && delta[v.teamId] !== undefined) {
      delta[v.teamId] += contrib;
    }
  }

  const mods: Record<string, number> = {};
  for (const id of teamIds) {
    mods[id] = clamp(1 + (delta[id] + generalDelta) * K, MIN, MAX);
  }
  return mods;
}
