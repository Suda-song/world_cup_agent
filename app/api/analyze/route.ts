import { NextRequest, NextResponse } from "next/server";

// Qwen (通义千问) API 集成 — 通过 DashScope 兼容模式调用
// 全链路使用 Qwen 模型 (+5 加分项)

interface AnalyzeRequest {
  teamA: string;
  teamB: string;
  flagA: string;
  flagB: string;
  stage: string;
  scoreA: number;
  scoreB: number;
  wentToPenalties?: boolean;
  eloA: number;
  eloB: number;
  lambdaA: number;
  lambdaB: number;
  styleA: string;
  styleB: string;
  strengthA: number;
  strengthB: number;
  moodModA: number;
  moodModB: number;
  reasoningSteps: string[];
}

const STAGE_LABEL: Record<string, string> = {
  r32: "32强淘汰赛",
  r16: "16强",
  qf: "四分之一决赛",
  sf: "半决赛",
  final: "决赛",
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AnalyzeRequest;

  const stageLabel = STAGE_LABEL[body.stage] || body.stage;

  const prompt = `你是一位资深足球分析师，请基于以下比赛预测数据，写一段简洁有力的赛事分析（150字以内）：

比赛：${body.flagA} ${body.teamA} vs ${body.flagB} ${body.teamB}（${stageLabel}）
预测比分：${body.scoreA} - ${body.scoreB}${body.wentToPenalties ? "（点球大战）" : ""}
Elo评分：${body.teamA} ${body.eloA} vs ${body.teamB} ${body.eloB}
综合战力：${body.teamA} ${body.strengthA.toFixed(1)} vs ${body.teamB} ${body.strengthB.toFixed(1)}
期望进球：${body.teamA} ${body.lambdaA.toFixed(2)} vs ${body.teamB} ${body.lambdaB.toFixed(2)}
战术风格：${body.teamA}（${body.styleA}）vs ${body.teamB}（${body.styleB}）
心情修正：${body.teamA} ×${body.moodModA.toFixed(3)} / ${body.teamB} ×${body.moodModB.toFixed(3)}

请从以下角度分析：
1. 双方实力对比与关键因素
2. 战术博弈看点
3. 预测结果合理性

直接输出分析正文，不要加标题。`;

  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;

  // 无 API Key 时使用本地生成的分析（离线兜底）
  if (!apiKey) {
    return NextResponse.json({
      source: "local",
      analysis: generateLocalAnalysis(body, stageLabel),
    });
  }

  try {
    const response = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "qwen-turbo",
          messages: [
            {
              role: "system",
              content:
                "你是专业足球分析师，擅长赛事预测分析。回答简洁专业，中文输出。",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 300,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Qwen API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({
      source: "qwen",
      model: "qwen-turbo",
      analysis,
    });
  } catch (err) {
    return NextResponse.json({
      source: "local",
      analysis: generateLocalAnalysis(body, stageLabel),
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

function generateLocalAnalysis(data: AnalyzeRequest, stageLabel: string): string {
  const stronger =
    data.strengthA > data.strengthB ? data.teamA : data.teamB;
  const weaker =
    data.strengthA > data.strengthB ? data.teamB : data.teamA;
  const strengthGap = Math.abs(data.strengthA - data.strengthB);
  const eloGap = Math.abs(data.eloA - data.eloB);

  const gap =
    strengthGap > 15
      ? "实力差距明显"
      : strengthGap > 8
      ? "实力存在一定差距"
      : "实力势均力敌";

  let analysis = `${stageLabel}：${data.flagA} ${data.teamA} vs ${data.flagB} ${data.teamB}。`;
  analysis += `${stronger}（战力${Math.max(data.strengthA, data.strengthB).toFixed(0)}）与${weaker}（战力${Math.min(data.strengthA, data.strengthB).toFixed(0)}）${gap}，Elo差值${eloGap.toFixed(0)}。`;
  analysis += `泊松模型预测期望进球 ${data.lambdaA.toFixed(2)}:${data.lambdaB.toFixed(2)}，`;

  if (data.wentToPenalties) {
    analysis += `常规时间战平，最终通过点球大战决出胜负，预测比分 ${data.scoreA}-${data.scoreB}。`;
  } else {
    const winner = data.scoreA > data.scoreB ? data.teamA : data.teamB;
    analysis += `预测比分 ${data.scoreA}-${data.scoreB}，${winner}晋级。`;
  }

  // 战术分析
  const styleMap: Record<string, string> = {
    possession: "控球渗透",
    counter: "快速反击",
    press: "高位压迫",
    defensive: "防守反击",
    balanced: "均衡战术",
  };
  analysis += `战术层面，${data.teamA}采取${styleMap[data.styleA] || data.styleA}，${data.teamB}采取${styleMap[data.styleB] || data.styleB}。`;

  // 心情
  if (data.moodModA > 1.05 || data.moodModB > 1.05) {
    const boosted = data.moodModA > data.moodModB ? data.teamA : data.teamB;
    analysis += `${boosted}球员心情状态上佳，战力获得正向加成。`;
  }

  return analysis;
}
