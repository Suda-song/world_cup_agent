import { NextRequest } from "next/server";
import { runWorldCupAgent, type WorldCupAgentResponse } from "@/lib/agent/worldcupAgent";
import { chatWithQwen } from "@/lib/agent/qwen";

export const dynamic = "force-dynamic";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** 流式辅助：逐字符发送文本，营造打字机效果 */
async function streamText(
  send: (obj: object) => void,
  text: string,
  chunkSize = 4,
  delayMs = 10,
) {
  let buf = "";
  for (const ch of text) {
    buf += ch;
    if (buf.length >= chunkSize) {
      send({ delta: buf });
      buf = "";
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  if (buf) send({ delta: buf });
}

/** 构建分阶段推演摘要文本（用于 streaming 展示推理过程） */
function buildStageNarrative(result: WorldCupAgentResponse): string {
  const lines: string[] = [];

  // === 小组赛摘要 ===
  lines.push("📊 【小组赛分析】");
  lines.push(
    `数据来源：${result.dataAudit.scheduleSource}，` +
    `已锁定 ${result.dataAudit.finishedMatchCount} 场真实赛果，` +
    `其余场次由 Elo+泊松模型模拟推演。`,
  );
  lines.push("");

  // === 淘汰赛逐轮 ===
  const stageNames: Record<string, string> = {
    r32: "⚔️ 【32强 · 淘汰赛第一轮】",
    r16: "⚔️ 【16强 · 淘汰赛第二轮】",
    qf: "🔥 【八强 · 四分之一决赛】",
    sf: "🏟️ 【四强 · 半决赛】",
    final: "🏆 【决赛】",
  };

  const stageOrder = ["r32", "r16", "qf", "sf", "final"];
  const grouped: Record<string, typeof result.championPath> = {};
  for (const m of result.championPath) {
    if (!grouped[m.stage]) grouped[m.stage] = [];
    grouped[m.stage].push(m);
  }

  for (const stage of stageOrder) {
    if (!grouped[stage]) continue;
    lines.push(stageNames[stage] ?? `【${stage}】`);
    for (const m of grouped[stage]) {
      const stateTag = m.state === "finished" ? "✅ 真实赛果" : "🔮 模型预测";
      lines.push(`  ${m.match}  — ${m.winner} 晋级  [${stateTag}]`);
    }
    lines.push("");
  }

  // === 决赛预测 ===
  if (result.finalPrediction) {
    lines.push("🏆 【决赛预测结论】");
    lines.push(
      `${result.finalPrediction.teamA}  ${result.finalPrediction.score}  ${result.finalPrediction.teamB}`,
    );
    lines.push(`预测冠军：${result.finalPrediction.winner}`);
    lines.push("");
  }

  // === 夺冠概率 Top5 ===
  lines.push("📈 【蒙特卡洛夺冠概率 Top 5】");
  result.topChampions.slice(0, 5).forEach((c, i) => {
    lines.push(`  ${i + 1}. ${c.team}  ${(c.probability * 100).toFixed(1)}%`);
  });
  lines.push("");

  // === 黑马 ===
  if (result.darkHorses.length > 0) {
    lines.push("💣 【最具潜力黑马】");
    result.darkHorses.slice(0, 2).forEach((d) => {
      lines.push(`  ${d.team}  FIFA #${d.fifaRank}  夺冠概率 ${(d.probability * 100).toFixed(1)}%`);
    });
    lines.push("");
  }

  // === 推理链路说明 ===
  lines.push("🔗 【推理链路】");
  lines.push("  1. 采集 football-data.org 真实赛程，已完成比赛直接锁定结果");
  lines.push("  2. 未知比赛使用泊松期望进球模型（基于 Elo 评分）预测比分");
  lines.push("  3. 淘汰赛平局引入 Elo 点球模型决出胜者");
  lines.push("  4. 整合球队心情修正 + 舆情观点修正系数");
  lines.push(`  5. 蒙特卡洛重复模拟 ${result.dataAudit.finishedMatchCount >= 0 ? "3,000" : "3,000"} 次，聚合晋级与夺冠概率`);
  lines.push("  6. Qwen AI 对结构化数据进行可解释性分析");
  lines.push("");

  return lines.join("\n");
}

/**
 * POST /api/agent/chat
 * body: { messages: ChatMessage[], isFirstRun?: boolean }
 *
 * 流式 SSE：每行 { delta: string } 或 { done: true, meta: {...} }
 * isFirstRun=true 时：分阶段 streaming 展示推演过程 + Qwen 报告
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    messages?: ChatMessage[];
    isFirstRun?: boolean;
  };

  const messages = body.messages ?? [];
  const isFirstRun = body.isFirstRun ?? false;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(encoder.encode("data: " + JSON.stringify(obj) + "\n\n"));
      }

      try {
        // ──────────────────────────────────────────────
        // 首次运行：分阶段推演 streaming
        // ──────────────────────────────────────────────
        if (isFirstRun || messages.length === 0) {

          // Step 1: 采集数据
          send({ delta: "🔄 正在采集真实赛程数据（football-data.org）…\n" });
          await new Promise((r) => setTimeout(r, 300));

          send({ delta: "⚙️  正在运行 Elo + 泊松 + 蒙特卡洛模拟（3,000 次）…\n" });
          const agentResult = await runWorldCupAgent({ task: "预测世界杯冠军", simCount: 3000 });
          await new Promise((r) => setTimeout(r, 200));

          // Step 2: 分阶段推演文本
          send({ delta: "\n" });
          const narrative = buildStageNarrative(agentResult);
          await streamText(send, narrative, 6, 12);

          // Step 3: Qwen AI 分析报告
          send({ delta: "\n---\n\n🤖 **Qwen AI 深度分析**\n\n" });
          await streamText(send, agentResult.report, 5, 8);

          // Step 4: 完成，附带结构化 meta 给前端渲染卡片
          const meta = {
            topChampions: agentResult.topChampions.slice(0, 8),
            finalPrediction: agentResult.finalPrediction,
            championPath: agentResult.championPath,
            darkHorses: agentResult.darkHorses,
            dataAudit: agentResult.dataAudit,
            reportSource: agentResult.reportSource,
            model: agentResult.model,
            reasoningChain: agentResult.reasoningChain,
          };

          send({ done: true, meta });
          controller.close();
          return;
        }

        // ──────────────────────────────────────────────
        // 多轮对话：带上下文调用 Qwen
        // ──────────────────────────────────────────────
        const userMessage = messages[messages.length - 1]?.content ?? "";
        const history = messages.slice(0, -1);

        // 把首条 assistant 消息（含完整推演报告）作为系统背景
        const firstAssistant = history.find((m) => m.role === "assistant");
        const systemPrompt = firstAssistant
          ? `你是专业的世界杯预测分析助手。用户已完整看过初始预测报告（含赛程推演、比分预测、夺冠概率），现在进行追问。
请基于已有报告内容回答，保持专业、简洁、有洞察力，不要重复整段报告，聚焦用户问题给出精准回答。
如用户问具体球队，结合 Elo 评分、历史数据和模拟概率作答。`
          : `你是专业的世界杯预测分析助手，请用中文回答用户关于2026世界杯的问题。`;

        const qwenMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
          { role: "system", content: systemPrompt },
          ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user", content: userMessage },
        ];

        const result = await chatWithQwen(
          qwenMessages,
          "抱歉，我暂时无法回答这个问题，请稍后再试。",
          { temperature: 0.5, maxTokens: 800 },
        );

        await streamText(send, result.content, 5, 10);
        send({ done: true, meta: { source: result.source, model: result.model } });

      } catch (err) {
        send({ delta: "\n❌ 推演出错：" + (err instanceof Error ? err.message : "未知错误") });
        send({ done: true, meta: {} });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
