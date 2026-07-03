// 核心数据类型定义

export type Confederation =
  | "UEFA"
  | "CONMEBOL"
  | "CONCACAF"
  | "CAF"
  | "AFC"
  | "OFC";

export type PlayStyle =
  | "possession" // 控球
  | "counter" // 反击
  | "press" // 高压
  | "defensive" // 防守
  | "balanced"; // 均衡

export interface TeamRatings {
  attack: number; // 进攻 0-100
  defense: number; // 防守 0-100
  midfield: number; // 中场 0-100
  speed: number; // 速度 0-100
  experience: number; // 经验 0-100
  form: number; // 状态 0-100
}

export interface Team {
  id: string;
  name: string;
  flag: string; // emoji 国旗
  elo: number;
  fifaRank: number;
  group: string; // A-L
  confederation: Confederation;
  style: PlayStyle;
  ratings: TeamRatings;
  isHost?: boolean;
}

export type Position = "GK" | "DF" | "MF" | "FW";

export interface MoodState {
  pressure: number; // 压力 0-100
  confidence: number; // 信心 0-100
  fatigue: number; // 疲劳 0-100
  motivation: number; // 动机 0-100
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  position: Position;
  overall: number; // 能力 0-100
  mood: MoodState;
  isStar?: boolean;
}

export interface HistoryRecord {
  teamA: string;
  teamB: string;
  played: number;
  aWins: number;
  draws: number;
  bWins: number;
  lastMeeting: string;
}

// 预测相关
export type Stage =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "final"
  | "champion";

export interface StageProbabilities {
  teamId: string;
  r32: number; // 晋级32强(小组出线)
  r16: number;
  qf: number;
  sf: number;
  final: number;
  champion: number;
}

export interface MatchResult {
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  stage: Stage;
  wentToPenalties?: boolean;
}

export interface TournamentResult {
  champion: string;
  runnerUp: string;
  matches: MatchResult[];
}

export interface MatchupPrediction {
  winA: number; // A胜概率
  draw: number;
  winB: number;
  expectedScoreA: number;
  expectedScoreB: number;
  likelyScore: { a: number; b: number };
}
