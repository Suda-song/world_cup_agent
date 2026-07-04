import { TEAM_MAP } from "@/lib/data/teams";
import type { DetailedSimResult } from "@/lib/prediction/detailedSim";
import type { MonteCarloResult } from "@/lib/prediction/monteCarlo";

export interface AgentDataAudit {
  scheduleSource: string;
  ratingsSource: string;
  viewpointCount: number;
  liveMatchCount: number;
  finishedMatchCount: number;
  cachePolicy: string;
}

export interface AgentReportInput {
  task: string;
  simCount: number;
  audit: AgentDataAudit;
  monteCarlo: MonteCarloResult;
  detailed: DetailedSimResult;
}

export function teamLabel(teamId: string): string {
  const team = TEAM_MAP[teamId];
  return team ? `${team.flag} ${team.name}` : teamId;
}

export function buildLocalReport(input: AgentReportInput): string {
  const top = input.monteCarlo.topChampions.slice(0, 5);
  const champion = top[0];
  const finalMatch = input.detailed.knockout.find((m) => m.stage === "final");
  const path = input.detailed.championPath
    .map((m) => `${teamLabel(m.teamA)} ${m.scoreA}-${m.scoreB} ${teamLabel(m.teamB)}`)
    .join("；");

  const topText = top
    .map((row, idx) => `${idx + 1}. ${teamLabel(row.teamId)} ${(row.pct * 100).toFixed(1)}%`)
    .join("；");

  return [
    `任务「${input.task}」已完成。`,
    champion
      ? `当前最可能冠军是 ${teamLabel(champion.teamId)}，夺冠概率 ${(champion.pct * 100).toFixed(1)}%。`
      : "当前没有得到稳定的冠军候选。",
    `冠军候选 Top 5：${topText || "暂无"}`,
    finalMatch
      ? `决赛预测：${teamLabel(finalMatch.teamA)} ${finalMatch.scoreA}-${finalMatch.scoreB} ${teamLabel(finalMatch.teamB)}，胜者 ${teamLabel(finalMatch.winner)}。`
      : "决赛预测暂不可用。",
    path ? `冠军路径：${path}。` : "冠军路径暂不可用。",
    `数据链路：赛程/赛果来自 ${input.audit.scheduleSource}，评分来自 ${input.audit.ratingsSource}，舆情观点 ${input.audit.viewpointCount} 条，模拟 ${input.simCount.toLocaleString()} 次。`,
  ].join("\n");
}

export function buildQwenPrompt(input: AgentReportInput): string {
  const top = input.monteCarlo.topChampions.slice(0, 8).map((row) => ({
    team: teamLabel(row.teamId),
    probability: `${(row.pct * 100).toFixed(1)}%`,
  }));
  const finalMatch = input.detailed.knockout.find((m) => m.stage === "final");
  const championPath = input.detailed.championPath.map((m) => ({
    stage: m.stage,
    match: `${teamLabel(m.teamA)} ${m.scoreA}-${m.scoreB} ${teamLabel(m.teamB)}`,
    winner: teamLabel(m.winner),
    state: m.matchState,
    keyFactors: m.reasoningSteps.slice(0, 3),
  }));
  const groups = input.detailed.groupStage.slice(0, 12).map((group) => ({
    group: group.group,
    source: group.isReal ? "真实赛果" : "模型预测",
    topThree: group.standings.slice(0, 3).map((row) => ({
      team: teamLabel(row.team.id),
      pts: row.pts,
      gd: row.gd,
    })),
  }));

  return JSON.stringify(
    {
      task: input.task,
      dataAudit: input.audit,
      dataExplanation: {
        topChampions: "蒙特卡洛概率：3000次完整赛程模拟聚合的夺冠概率排名，反映长期期望",
        finalPrediction: "单次最优路径推演：基于Elo+泊松模型的确定性预测，反映最可能发生的具体赛程",
        note: "两者数据来源不同，冠军概率排名第一的队未必是单次推演的冠军，这属正常现象",
      },
      method: [
        "已完成比赛直接锁定真实结果",
        "未完成比赛使用泊松期望进球模型预测比分",
        "淘汰赛平局使用 Elo 点球模型",
        "通过蒙特卡洛重复模拟聚合晋级与夺冠概率",
      ],
      topChampions: top,
      finalPrediction: finalMatch
        ? {
            match: `${teamLabel(finalMatch.teamA)} vs ${teamLabel(finalMatch.teamB)}`,
            score: `${finalMatch.scoreA}-${finalMatch.scoreB}`,
            winner: teamLabel(finalMatch.winner),
            note: "此为单次最优路径推演结果，与蒙特卡洛概率排名可能不同",
          }
        : null,
      championPath,
      groupHighlights: groups,
    },
    null,
    2,
  );
}
