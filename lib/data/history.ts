import type { HistoryRecord } from "../types";

// 主要国家队历史交锋记录（精选经典对阵）
export const HISTORY: HistoryRecord[] = [
  { teamA: "arg", teamB: "bra", played: 96, aWins: 40, draws: 26, bWins: 30, lastMeeting: "阿根廷 1-0 巴西 (2023决赛)" },
  { teamA: "arg", teamB: "fra", played: 12, aWins: 6, draws: 3, bWins: 3, lastMeeting: "阿根廷 3-3(点球) 法国 (2022决赛)" },
  { teamA: "eng", teamB: "ger", played: 32, aWins: 13, draws: 5, bWins: 14, lastMeeting: "英格兰 2-0 德国 (2021)" },
  { teamA: "esp", teamB: "ger", played: 26, aWins: 9, draws: 8, bWins: 9, lastMeeting: "西班牙 1-1 德国 (2024欧洲杯)" },
  { teamA: "esp", teamB: "ita", played: 31, aWins: 13, draws: 11, bWins: 7, lastMeeting: "西班牙 2-1 意大利 (2023)" },
  { teamA: "bra", teamB: "ger", played: 23, aWins: 12, draws: 5, bWins: 6, lastMeeting: "德国 1-0 巴西 (2024)" },
  { teamA: "ned", teamB: "arg", played: 9, aWins: 4, draws: 1, bWins: 4, lastMeeting: "阿根廷 2-2(点球) 荷兰 (2022)" },
  { teamA: "por", teamB: "esp", played: 40, aWins: 6, draws: 16, bWins: 18, lastMeeting: "西班牙 1-0 葡萄牙 (2024)" },
  { teamA: "por", teamB: "fra", played: 28, aWins: 6, draws: 4, bWins: 18, lastMeeting: "法国 2-1 葡萄牙 (2024欧洲杯)" },
  { teamA: "fra", teamB: "bel", played: 75, aWins: 30, draws: 19, bWins: 26, lastMeeting: "法国 3-2 比利时 (2021)" },
  { teamA: "eng", teamB: "fra", played: 31, aWins: 17, draws: 5, bWins: 9, lastMeeting: "法国 2-1 英格兰 (2022)" },
  { teamA: "uru", teamB: "bra", played: 78, aWins: 21, draws: 18, bWins: 39, lastMeeting: "巴西 2-0 乌拉圭 (2023)" },
  { teamA: "col", teamB: "bra", played: 35, aWins: 9, draws: 11, bWins: 15, lastMeeting: "哥伦比亚 2-1 巴西 (2023)" },
  { teamA: "arg", teamB: "ned", played: 9, aWins: 4, draws: 1, bWins: 4, lastMeeting: "阿根廷 2-2(点球) 荷兰 (2022)" },
  { teamA: "mar", teamB: "esp", played: 3, aWins: 0, draws: 1, bWins: 2, lastMeeting: "西班牙 2-2(点球) 摩洛哥 (2022)" },
  { teamA: "usa", teamB: "mex", played: 76, aWins: 23, draws: 15, bWins: 38, lastMeeting: "美国 2-0 墨西哥 (2024)" },
  { teamA: "usa", teamB: "eng", played: 12, aWins: 2, draws: 4, bWins: 6, lastMeeting: "英格兰 1-1 美国 (2022)" },
  { teamA: "jpn", teamB: "kor", played: 80, aWins: 42, draws: 23, bWins: 15, lastMeeting: "日本 3-0 韩国 (2024)" },
  { teamA: "cro", teamB: "ita", played: 9, aWins: 1, draws: 5, bWins: 3, lastMeeting: "意大利 1-0 克罗地亚 (2024欧洲杯)" },
  { teamA: "ita", teamB: "fra", played: 38, aWins: 10, draws: 9, bWins: 19, lastMeeting: "法国 3-1 意大利 (2024)" },
  { teamA: "aus", teamB: "jpn", played: 27, aWins: 6, draws: 7, bWins: 14, lastMeeting: "日本 1-1 澳大利亚 (2024)" },
  { teamA: "sen", teamB: "ned", played: 4, aWins: 1, draws: 1, bWins: 2, lastMeeting: "荷兰 2-0 塞内加尔 (2022)" },
  { teamA: "mex", teamB: "arg", played: 35, aWins: 7, draws: 11, bWins: 17, lastMeeting: "阿根廷 3-0 墨西哥 (2022)" },
  { teamA: "ecu", teamB: "arg", played: 16, aWins: 1, draws: 3, bWins: 12, lastMeeting: "阿根廷 1-0 厄瓜多尔 (2024)" },
  { teamA: "ita", teamB: "esp", played: 31, aWins: 7, draws: 11, bWins: 13, lastMeeting: "西班牙 2-1 意大利 (2023)" },
  { teamA: "por", teamB: "ned", played: 13, aWins: 7, draws: 3, bWins: 3, lastMeeting: "葡萄牙 2-2(点球) 荷兰 (无近期)" },
  { teamA: "bel", teamB: "ned", played: 130, aWins: 41, draws: 31, bWins: 58, lastMeeting: "荷兰 1-0 比利时 (2024)" },
  { teamA: "gha", teamB: "uru", played: 3, aWins: 1, draws: 0, bWins: 2, lastMeeting: "乌拉圭 2-0 加纳 (2022)" },
  { teamA: "can", teamB: "usa", played: 40, aWins: 9, draws: 11, bWins: 20, lastMeeting: "美国 2-1 加拿大 (2024)" },
];

export function findHistory(a: string, b: string): HistoryRecord | undefined {
  return HISTORY.find(
    (h) =>
      (h.teamA === a && h.teamB === b) || (h.teamA === b && h.teamB === a)
  );
}
