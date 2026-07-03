import type { Team } from "../types";

// 2026 美加墨世界杯 48 队种子数据（12 组 × 4 队）
// Elo/FIFA排名/评分为基于真实表现的合理建模
export const TEAMS: Team[] = [
  // ===== A 组 =====
  { id: "mex", name: "墨西哥", flag: "🇲🇽", elo: 1660, fifaRank: 17, group: "A", confederation: "CONCACAF", style: "counter", isHost: true, ratings: { attack: 68, defense: 66, midfield: 64, speed: 67, experience: 72, form: 64 } },
  { id: "nor", name: "挪威", flag: "🇳🇴", elo: 1700, fifaRank: 30, group: "A", confederation: "UEFA", style: "counter", ratings: { attack: 74, defense: 64, midfield: 66, speed: 73, experience: 60, form: 70 } },
  { id: "irq", name: "伊拉克", flag: "🇮🇶", elo: 1450, fifaRank: 58, group: "A", confederation: "AFC", style: "defensive", ratings: { attack: 56, defense: 58, midfield: 55, speed: 60, experience: 58, form: 56 } },
  { id: "nzl", name: "新西兰", flag: "🇳🇿", elo: 1380, fifaRank: 100, group: "A", confederation: "OFC", style: "defensive", ratings: { attack: 50, defense: 52, midfield: 50, speed: 54, experience: 55, form: 52 } },

  // ===== B 组 =====
  { id: "can", name: "加拿大", flag: "🇨🇦", elo: 1620, fifaRank: 30, group: "B", confederation: "CONCACAF", style: "counter", isHost: true, ratings: { attack: 70, defense: 60, midfield: 62, speed: 74, experience: 58, form: 66 } },
  { id: "mar", name: "摩洛哥", flag: "🇲🇦", elo: 1750, fifaRank: 13, group: "B", confederation: "CAF", style: "defensive", ratings: { attack: 72, defense: 80, midfield: 72, speed: 70, experience: 68, form: 72 } },
  { id: "ukr", name: "乌克兰", flag: "🇺🇦", elo: 1660, fifaRank: 25, group: "B", confederation: "UEFA", style: "balanced", ratings: { attack: 70, defense: 66, midfield: 68, speed: 68, experience: 64, form: 66 } },
  { id: "jor", name: "约旦", flag: "🇯🇴", elo: 1440, fifaRank: 62, group: "B", confederation: "AFC", style: "defensive", ratings: { attack: 54, defense: 57, midfield: 54, speed: 58, experience: 56, form: 60 } },

  // ===== C 组 =====
  { id: "usa", name: "美国", flag: "🇺🇸", elo: 1690, fifaRank: 16, group: "C", confederation: "CONCACAF", style: "press", isHost: true, ratings: { attack: 71, defense: 65, midfield: 66, speed: 73, experience: 64, form: 65 } },
  { id: "cro", name: "克罗地亚", flag: "🇭🇷", elo: 1860, fifaRank: 10, group: "C", confederation: "UEFA", style: "possession", ratings: { attack: 73, defense: 74, midfield: 80, speed: 64, experience: 82, form: 66 } },
  { id: "sen", name: "塞内加尔", flag: "🇸🇳", elo: 1680, fifaRank: 18, group: "C", confederation: "CAF", style: "counter", ratings: { attack: 73, defense: 68, midfield: 67, speed: 75, experience: 64, form: 68 } },
  { id: "uzb", name: "乌兹别克斯坦", flag: "🇺🇿", elo: 1470, fifaRank: 57, group: "C", confederation: "AFC", style: "balanced", ratings: { attack: 58, defense: 58, midfield: 57, speed: 60, experience: 54, form: 62 } },

  // ===== D 组 =====
  { id: "fra", name: "法国", flag: "🇫🇷", elo: 2030, fifaRank: 2, group: "D", confederation: "UEFA", style: "balanced", ratings: { attack: 88, defense: 82, midfield: 84, speed: 86, experience: 84, form: 82 } },
  { id: "irn", name: "伊朗", flag: "🇮🇷", elo: 1610, fifaRank: 21, group: "D", confederation: "AFC", style: "defensive", ratings: { attack: 64, defense: 66, midfield: 62, speed: 64, experience: 66, form: 62 } },
  { id: "par", name: "巴拉圭", flag: "🇵🇾", elo: 1560, fifaRank: 40, group: "D", confederation: "CONMEBOL", style: "defensive", ratings: { attack: 60, defense: 64, midfield: 60, speed: 62, experience: 62, form: 60 } },
  { id: "tun", name: "突尼斯", flag: "🇹🇳", elo: 1530, fifaRank: 41, group: "D", confederation: "CAF", style: "counter", ratings: { attack: 58, defense: 62, midfield: 58, speed: 62, experience: 60, form: 58 } },

  // ===== E 组 =====
  { id: "arg", name: "阿根廷", flag: "🇦🇷", elo: 2050, fifaRank: 1, group: "E", confederation: "CONMEBOL", style: "possession", ratings: { attack: 90, defense: 82, midfield: 86, speed: 80, experience: 88, form: 86 } },
  { id: "jpn", name: "日本", flag: "🇯🇵", elo: 1720, fifaRank: 15, group: "E", confederation: "AFC", style: "possession", ratings: { attack: 74, defense: 70, midfield: 74, speed: 76, experience: 70, form: 74 } },
  { id: "ecu", name: "厄瓜多尔", flag: "🇪🇨", elo: 1650, fifaRank: 24, group: "E", confederation: "CONMEBOL", style: "press", ratings: { attack: 66, defense: 68, midfield: 64, speed: 70, experience: 62, form: 66 } },
  { id: "civ", name: "科特迪瓦", flag: "🇨🇮", elo: 1560, fifaRank: 42, group: "E", confederation: "CAF", style: "counter", ratings: { attack: 64, defense: 60, midfield: 62, speed: 70, experience: 60, form: 62 } },

  // ===== F 组 =====
  { id: "eng", name: "英格兰", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", elo: 1990, fifaRank: 4, group: "F", confederation: "UEFA", style: "possession", ratings: { attack: 86, defense: 80, midfield: 82, speed: 82, experience: 80, form: 80 } },
  { id: "sui", name: "瑞士", flag: "🇨🇭", elo: 1740, fifaRank: 19, group: "F", confederation: "UEFA", style: "defensive", ratings: { attack: 70, defense: 74, midfield: 70, speed: 66, experience: 72, form: 68 } },
  { id: "egy", name: "埃及", flag: "🇪🇬", elo: 1580, fifaRank: 33, group: "F", confederation: "CAF", style: "counter", ratings: { attack: 66, defense: 64, midfield: 62, speed: 66, experience: 64, form: 64 } },
  { id: "ksa", name: "沙特阿拉伯", flag: "🇸🇦", elo: 1500, fifaRank: 56, group: "F", confederation: "AFC", style: "possession", ratings: { attack: 58, defense: 58, midfield: 58, speed: 60, experience: 58, form: 56 } },

  // ===== G 组 =====
  { id: "bra", name: "巴西", flag: "🇧🇷", elo: 1980, fifaRank: 5, group: "G", confederation: "CONMEBOL", style: "possession", ratings: { attack: 88, defense: 78, midfield: 82, speed: 84, experience: 82, form: 78 } },
  { id: "srb", name: "塞尔维亚", flag: "🇷🇸", elo: 1640, fifaRank: 32, group: "G", confederation: "UEFA", style: "balanced", ratings: { attack: 70, defense: 64, midfield: 68, speed: 64, experience: 66, form: 62 } },
  { id: "cmr", name: "喀麦隆", flag: "🇨🇲", elo: 1550, fifaRank: 50, group: "G", confederation: "CAF", style: "counter", ratings: { attack: 64, defense: 60, midfield: 60, speed: 68, experience: 62, form: 60 } },
  { id: "aus", name: "澳大利亚", flag: "🇦🇺", elo: 1570, fifaRank: 26, group: "G", confederation: "AFC", style: "press", ratings: { attack: 62, defense: 62, midfield: 60, speed: 64, experience: 64, form: 60 } },

  // ===== H 组 =====
  { id: "esp", name: "西班牙", flag: "🇪🇸", elo: 2000, fifaRank: 3, group: "H", confederation: "UEFA", style: "possession", ratings: { attack: 86, defense: 80, midfield: 88, speed: 80, experience: 78, form: 84 } },
  { id: "col", name: "哥伦比亚", flag: "🇨🇴", elo: 1770, fifaRank: 12, group: "H", confederation: "CONMEBOL", style: "counter", ratings: { attack: 76, defense: 72, midfield: 72, speed: 74, experience: 70, form: 74 } },
  { id: "kor", name: "韩国", flag: "🇰🇷", elo: 1620, fifaRank: 23, group: "H", confederation: "AFC", style: "press", ratings: { attack: 70, defense: 66, midfield: 68, speed: 76, experience: 68, form: 68 } },
  { id: "mli", name: "马里", flag: "🇲🇱", elo: 1540, fifaRank: 52, group: "H", confederation: "CAF", style: "counter", ratings: { attack: 62, defense: 58, midfield: 60, speed: 68, experience: 56, form: 60 } },

  // ===== I 组 =====
  { id: "ger", name: "德国", flag: "🇩🇪", elo: 1850, fifaRank: 11, group: "I", confederation: "UEFA", style: "possession", ratings: { attack: 82, defense: 76, midfield: 82, speed: 76, experience: 84, form: 78 } },
  { id: "uru", name: "乌拉圭", flag: "🇺🇾", elo: 1760, fifaRank: 14, group: "I", confederation: "CONMEBOL", style: "counter", ratings: { attack: 76, defense: 74, midfield: 70, speed: 70, experience: 76, form: 72 } },
  { id: "gha", name: "加纳", flag: "🇬🇭", elo: 1540, fifaRank: 73, group: "I", confederation: "CAF", style: "counter", ratings: { attack: 62, defense: 58, midfield: 60, speed: 68, experience: 58, form: 60 } },
  { id: "pan", name: "巴拿马", flag: "🇵🇦", elo: 1450, fifaRank: 31, group: "I", confederation: "CONCACAF", style: "defensive", ratings: { attack: 56, defense: 58, midfield: 54, speed: 58, experience: 58, form: 54 } },

  // ===== J 组 =====
  { id: "por", name: "葡萄牙", flag: "🇵🇹", elo: 1960, fifaRank: 6, group: "J", confederation: "UEFA", style: "possession", ratings: { attack: 84, defense: 78, midfield: 80, speed: 78, experience: 80, form: 80 } },
  { id: "den", name: "丹麦", flag: "🇩🇰", elo: 1700, fifaRank: 20, group: "J", confederation: "UEFA", style: "balanced", ratings: { attack: 70, defense: 70, midfield: 70, speed: 66, experience: 70, form: 66 } },
  { id: "alg", name: "阿尔及利亚", flag: "🇩🇿", elo: 1580, fifaRank: 38, group: "J", confederation: "CAF", style: "counter", ratings: { attack: 66, defense: 64, midfield: 64, speed: 66, experience: 62, form: 62 } },
  { id: "crc", name: "哥斯达黎加", flag: "🇨🇷", elo: 1490, fifaRank: 54, group: "J", confederation: "CONCACAF", style: "defensive", ratings: { attack: 56, defense: 60, midfield: 56, speed: 58, experience: 60, form: 56 } },

  // ===== K 组 =====
  { id: "ned", name: "荷兰", flag: "🇳🇱", elo: 1950, fifaRank: 7, group: "K", confederation: "UEFA", style: "possession", ratings: { attack: 82, defense: 80, midfield: 80, speed: 76, experience: 78, form: 80 } },
  { id: "bel", name: "比利时", flag: "🇧🇪", elo: 1880, fifaRank: 8, group: "K", confederation: "UEFA", style: "counter", ratings: { attack: 80, defense: 74, midfield: 76, speed: 76, experience: 76, form: 74 } },
  { id: "nga", name: "尼日利亚", flag: "🇳🇬", elo: 1570, fifaRank: 36, group: "K", confederation: "CAF", style: "counter", ratings: { attack: 66, defense: 60, midfield: 62, speed: 72, experience: 60, form: 62 } },
  { id: "jam", name: "牙买加", flag: "🇯🇲", elo: 1460, fifaRank: 60, group: "K", confederation: "CONCACAF", style: "counter", ratings: { attack: 58, defense: 56, midfield: 54, speed: 66, experience: 54, form: 58 } },

  // ===== L 组 =====
  { id: "tur", name: "土耳其", flag: "🇹🇷", elo: 1700, fifaRank: 27, group: "L", confederation: "UEFA", style: "counter", ratings: { attack: 72, defense: 66, midfield: 70, speed: 72, experience: 64, form: 70 } },
  { id: "aut", name: "奥地利", flag: "🇦🇹", elo: 1670, fifaRank: 22, group: "L", confederation: "UEFA", style: "press", ratings: { attack: 70, defense: 68, midfield: 68, speed: 68, experience: 64, form: 68 } },
  { id: "cpv", name: "佛得角", flag: "🇨🇻", elo: 1480, fifaRank: 70, group: "L", confederation: "CAF", style: "counter", ratings: { attack: 58, defense: 56, midfield: 56, speed: 62, experience: 54, form: 58 } },
  { id: "qat", name: "卡塔尔", flag: "🇶🇦", elo: 1420, fifaRank: 53, group: "L", confederation: "AFC", style: "possession", ratings: { attack: 54, defense: 54, midfield: 54, speed: 56, experience: 52, form: 54 } },
];

export const TEAM_MAP: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t])
);

export const GROUPS: string[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

export function teamsInGroup(group: string): Team[] {
  return TEAMS.filter((t) => t.group === group);
}
