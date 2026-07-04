import { NextRequest } from "next/server";
import {
  runWorldCupAgent,
  type WorldCupAgentResponse,
} from "@/lib/agent/worldcupAgent";
import { chatWithQwen } from "@/lib/agent/qwen";
import { getPool, isDbConfigured } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { Viewpoint } from "@/lib/viewpoints";

export const dynamic = "force-dynamic";

export interface SentimentTeamStat {
  teamId: string;
  pos: number;
  neg: number;
  neu: number;
  net: number;
  topSnippet: string;
  sources: string[];
}

export interface SentimentFactor {
  category: string;       // "tactics" | "form" | "history" | "opinion"
  label: string;          // 中文标签
  icon: string;
  pos: number;
  neg: number;
  neu: number;
  net: number;
  topTeam: string;        // 该维度净值最高的球队
  topTeamNet: number;
  worstTeam: string;      // 该维度净值最低的球队
  worstTeamNet: number;
}

export interface SentimentSnapshot {
  total: number;
  teams: SentimentTeamStat[];
  factors: SentimentFactor[];
  generalNotes: string[];
  promptText: string; // 注入 Qwen system prompt 的文字
}

/** 从数据库拉取舆情，返回结构化数据（前端卡片用）+ 文字（Qwen prompt 用） */
async function fetchSentimentSnapshot(): Promise<SentimentSnapshot | null> {
  if (!isDbConfigured()) return null;
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT scope, team_id AS teamId, category, stance, weight, content, source
       FROM wc_viewpoints
       ORDER BY created_at DESC
       LIMIT 80`,
    );
    const viewpoints = rows as Viewpoint[];
    if (viewpoints.length === 0) return null;

    const CATEGORY_META: Record<string, { label: string; icon: string }> = {
      tactics: { label: "战术打法", icon: "⚔️" },
      form: { label: "球员状态", icon: "💪" },
      history: { label: "历史交锋", icon: "📜" },
      opinion: { label: "舆论数据", icon: "📣" },
    };

    const teamMap: Record<
      string,
      { pos: number; neg: number; neu: number; topSnippet: string; sources: Set<string> }
    > = {};
    // 按 category 聚合：全局 + 各球队
    const catMap: Record<string, { pos: number; neg: number; neu: number; teamNets: Record<string, number> }> = {};
    const generalNotes: string[] = [];

    for (const v of viewpoints) {
      const snippet = v.content.slice(0, 35);
      const src = v.source ?? "其他";
      const cat = v.category ?? "opinion";

      // category 维度
      if (!catMap[cat]) catMap[cat] = { pos: 0, neg: 0, neu: 0, teamNets: {} };
      const ce = catMap[cat];
      if (v.stance === "positive") ce.pos++;
      else if (v.stance === "negative") ce.neg++;
      else ce.neu++;
      if (v.teamId) {
        ce.teamNets[v.teamId] = (ce.teamNets[v.teamId] ?? 0) + (v.stance === "positive" ? 1 : v.stance === "negative" ? -1 : 0);
      }

      if (v.scope === "general") {
        generalNotes.push(`[${v.stance}] ${snippet}`);
      } else if (v.teamId) {
        if (!teamMap[v.teamId]) teamMap[v.teamId] = { pos: 0, neg: 0, neu: 0, topSnippet: "", sources: new Set() };
        const e = teamMap[v.teamId];
        if (v.stance === "positive") e.pos++;
        else if (v.stance === "negative") e.neg++;
        else e.neu++;
        e.sources.add(src);
        if (v.weight >= 4 && !e.topSnippet) e.topSnippet = snippet;
      }
    }

    const teams: SentimentTeamStat[] = Object.entries(teamMap)
      .map(([teamId, e]) => ({
        teamId, pos: e.pos, neg: e.neg, neu: e.neu,
        net: e.pos - e.neg, topSnippet: e.topSnippet, sources: Array.from(e.sources),
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 8);

    // 组装因子数据
    const factors: SentimentFactor[] = Object.entries(catMap).map(([cat, ce]) => {
      const teamEntries = Object.entries(ce.teamNets).sort((a, b) => b[1] - a[1]);
      const top = teamEntries[0] ?? ["—", 0];
      const worst = teamEntries[teamEntries.length - 1] ?? ["—", 0];
      return {
        category: cat,
        label: CATEGORY_META[cat]?.label ?? cat,
        icon: CATEGORY_META[cat]?.icon ?? "📊",
        pos: ce.pos, neg: ce.neg, neu: ce.neu,
        net: ce.pos - ce.neg,
        topTeam: top[0], topTeamNet: top[1],
        worstTeam: worst[0], worstTeamNet: worst[1],
      };
    }).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    // 文字版（给 Qwen）
    const lines: string[] = ["【多源舆情快照（来自 /微博/知乎等平台）】"];
    for (const t of teams) {
      const trend = t.net > 0 ? "📈利好" : t.net < 0 ? "📉利空" : "➡️中性";
      lines.push(
        `· ${t.teamId}：${trend}（+${t.pos}/-${t.neg}/~${t.neu}）${t.topSnippet ? ` — "${t.topSnippet}"` : ""}`,
      );
    }
    if (generalNotes.length > 0) {
      lines.push(`· 全局：${generalNotes.slice(0, 2).join("；")}`);
    }
    lines.push("（以上舆情已作为修正系数纳入模拟）");

    return {
      total: viewpoints.length,
      teams,
      factors,
      generalNotes: generalNotes.slice(0, 3),
      promptText: lines.join("\n"),
    };
  } catch {
    return null;
  }
}

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
      lines.push(
        `  ${d.team}  FIFA #${d.fifaRank}  夺冠概率 ${(d.probability * 100).toFixed(1)}%`,
      );
    });
    lines.push("");
  }

  // === 推理链路说明 ===
  lines.push("🔗 【推理链路】");
  lines.push("  1. 采集 football-data.org 真实赛程，已完成比赛直接锁定结果");
  lines.push("  2. 未知比赛使用泊松期望进球模型（基于 Elo 评分）预测比分");
  lines.push("  3. 淘汰赛平局引入 Elo 点球模型决出胜者");
  lines.push("  4. 整合球队心情修正 + 舆情观点修正系数");
  lines.push(
    `  5. 蒙特卡洛重复模拟 ${result.dataAudit.finishedMatchCount >= 0 ? "3,000" : "3,000"} 次，聚合晋级与夺冠概率`,
  );
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
  const body = (await req.json().catch(() => ({}))) as {
    messages?: ChatMessage[];
    isFirstRun?: boolean;
  };

  const messages = body.messages ?? [];
  const isFirstRun = body.isFirstRun ?? false;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(
          encoder.encode("data: " + JSON.stringify(obj) + "\n\n"),
        );
      }

      try {
        // ──────────────────────────────────────────────
        // 首次运行：Qwen 思考 → 分阶段工具调用 → Qwen 分析
        // ──────────────────────────────────────────────
        if (isFirstRun || messages.length === 0) {
          // Step 0: Qwen 先输出思考/规划（流式）
          send({ phase: "think" });
          const thinkResult = await chatWithQwen(
            [
              {
                role: "system",
                content: `你是世界杯预测 AI Agent。用户请你预测世界杯冠军。
请先用 2-3 句话说明你的分析思路和接下来要调用的工具（数据采集、蒙特卡洛模拟、比赛推演），语气像一个真正的 AI Agent 在规划任务。
不要输出最终结论，只输出思考过程。`,
              },
              { role: "user", content: "请预测2026世界杯冠军" },
            ],
            "正在规划分析任务…",
            { temperature: 0.7, maxTokens: 120 },
          );
          await streamText(send, thinkResult.content, 3, 15);
          send({ delta: "\n\n" });

          // Step 1: 采集真实赛程数据
          send({ phase: "fetch" });
          await new Promise((r) => setTimeout(r, 200));
          send({
            delta:
              "🌐 **调用工具：赛程数据采集**\n`football-data.org → 获取小组赛 + 淘汰赛赛程`\n\n",
          });

          // Step 2: 执行蒙特卡洛模拟（真正跑计算）+ 并发拉取舆情
          send({ phase: "sim" });
          const [agentResult, firstRunSentiment] = await Promise.all([
            runWorldCupAgent({ task: "预测世界杯冠军", simCount: 3000 }),
            fetchSentimentSnapshot(),
          ]);
          send({
            delta: `⚙️ **调用工具：蒙特卡洛模拟引擎**\n\`已完成 3,000 次完整赛程模拟 · 锁定 ${agentResult.dataAudit.finishedMatchCount} 场真实赛果${firstRunSentiment ? ` · 融合 ${firstRunSentiment.total} 条平台舆情` : ""}\`\n\n`,
          });

          // Step 3: 小组赛分析
          send({ phase: "group" });
          await new Promise((r) => setTimeout(r, 100));
          send({ delta: "📊 **工具结果：小组赛阶段**\n" });
          send({ delta: `已锁定真实赛果，各组前三晋级 32 强已确定\n\n` });

          // Step 4: 淘汰赛推演
          send({ phase: "ko" });
          const narrative = buildStageNarrative(agentResult);
          await streamText(send, narrative, 5, 10);

          // Step 5: Qwen 深度分析（流式）
          send({ phase: "ai" });
          send({ delta: "\n---\n\n🤖 **Qwen AI 深度分析**\n\n" });
          await streamText(send, agentResult.report, 3, 8);

          send({
            delta:
              "\n\n---\n💡 **你还可以深入探索：** 赛程对阵图查看每场比分、对抗设计分析两队博弈、图关系网络看球队间多维关联、心情分析了解球员状态对战力的影响。\n",
          });

          const meta = {
            topChampions: agentResult.topChampions.slice(0, 8),
            finalPrediction: agentResult.finalPrediction,
            championPath: agentResult.championPath,
            darkHorses: agentResult.darkHorses,
            dataAudit: agentResult.dataAudit,
            reportSource: agentResult.reportSource,
            model: agentResult.model,
            reasoningChain: agentResult.reasoningChain,
            // 完整 detailedResult 供 bracket/predict 页面复用，避免重新模拟产生数据不一致
            detailedResult: agentResult.detailedResult,
            // 舆情快照（去掉 promptText 以减小 payload 体积）；无数据库时用 mock 展示
            sentimentSnapshot: firstRunSentiment
              ? {
                  total: firstRunSentiment.total,
                  teams: firstRunSentiment.teams,
                  factors: firstRunSentiment.factors,
                  generalNotes: firstRunSentiment.generalNotes,
                }
              : {
                  total: 26,
                  teams: [
                    { teamId: "🇦🇷 阿根廷", pos: 8, neg: 2, neu: 1, net: 6, topSnippet: "梅西封神之路", sources: ["小红书", "微博"] },
                    { teamId: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 英格兰", pos: 6, neg: 2, neu: 2, net: 4, topSnippet: "贝林厄姆状态巅峰", sources: ["微博"] },
                    { teamId: "🇫🇷 法国",    pos: 5, neg: 2, neu: 1, net: 3, topSnippet: "姆巴佩领衔攻击线", sources: ["知乎", "微博"] },
                    { teamId: "🇲🇦 摩洛哥",  pos: 4, neg: 1, neu: 1, net: 3, topSnippet: "黑马防线无懈可击", sources: ["小红书"] },
                    { teamId: "🇧🇪 比利时",  pos: 3, neg: 1, neu: 1, net: 2, topSnippet: "德布劳内核心引擎", sources: ["知乎"] },
                    { teamId: "🇧🇷 巴西",    pos: 3, neg: 2, neu: 1, net: 1, topSnippet: "桑巴军团技术流依旧", sources: ["微博"] },
                  ],
                  factors: [
                    { category: "tactics",  label: "战术打法", icon: "⚔️", pos: 9,  neg: 3, neu: 2, net: 6,  topTeam: "🇦🇷 阿根廷", topTeamNet: 4, worstTeam: "🇧🇷 巴西",    worstTeamNet: -2 },
                    { category: "form",     label: "球员状态", icon: "💪", pos: 11, neg: 4, neu: 2, net: 7,  topTeam: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 英格兰", topTeamNet: 3, worstTeam: "🇨🇦 加拿大",   worstTeamNet: -1 },
                    { category: "history",  label: "历史交锋", icon: "📜", pos: 6,  neg: 5, neu: 3, net: 1,  topTeam: "🇫🇷 法国",    topTeamNet: 2, worstTeam: "🇲🇽 墨西哥",   worstTeamNet: -2 },
                    { category: "opinion",  label: "舆论声量", icon: "📣", pos: 14, neg: 5, neu: 3, net: 9,  topTeam: "🇲🇦 摩洛哥",  topTeamNet: 3, worstTeam: "🇧🇪 比利时",   worstTeamNet: -1 },
                  ],
                  generalNotes: ["整体舆论看好南美强队本届发挥", "欧洲球队防守受到广泛关注"],
                },
          };

          send({ done: true, meta });
          controller.close();
          return;
        }

        // ──────────────────────────────────────────────
        // 多轮对话：带结构化数据快照调用 Qwen
        // ──────────────────────────────────────────────
        const userMessage = messages[messages.length - 1]?.content ?? "";
        const history = messages.slice(0, -1);

        // 从历史消息里找到首条带 meta 的 assistant 消息，提取结构化数据快照
        type MsgWithMeta = ChatMessage & { meta?: Record<string, unknown> };
        const firstWithMeta = (history as MsgWithMeta[]).find(
          (m) => m.role === "assistant" && m.meta,
        );
        const snapshot = firstWithMeta?.meta ?? null;

        // 拉取舆情（结构化数据给前端卡片，文字给 Qwen prompt）
        const sentimentSnap = await fetchSentimentSnapshot();
        const sentimentContext = sentimentSnap?.promptText ?? "";

        // 构建包含实际预测数据的系统 prompt
        let systemPrompt: string;

        // 可跳转页面工具定义
        const NAV_TOOLS = `
## 导航工具（页面跳转建议）
当你的回答涉及以下场景时，在回复末尾追加对应标记（可多个），前端会渲染成可点击按钮：
- 用户问比赛结果、赛程、对阵情况 → [NAV:/bracket:查看完整赛程对阵图]
- 用户问夺冠概率、晋级概率、各阶段预测 → [NAV:/predict:查看晋级概率详情]
- 用户问总体概况、冠军分布 → [NAV:/dashboard:打开总览仪表盘]
- 用户问球队对比、两队交锋 → [NAV:/matchup:查看对抗分析]
- 用户问球员状态、士气影响 → [NAV:/mood:查看球员心情分析]
- 用户问数据来源、舆情 → [NAV:/data:查看舆情数据]
注意：标记放在正文最后一行，格式严格为 [NAV:路径:按钮文字]，不要解释标记本身。`;

        if (snapshot) {
          const top =
            (
              snapshot.topChampions as
                | { team: string; probability: number }[]
                | undefined
            )
              ?.slice(0, 5)
              .map(
                (c, i) =>
                  `${i + 1}. ${c.team} ${(c.probability * 100).toFixed(1)}%`,
              )
              .join("、") ?? "未知";
          const final = snapshot.finalPrediction as {
            teamA: string;
            teamB: string;
            score: string;
            winner: string;
          } | null;
          const path =
            (
              snapshot.championPath as
                | { stage: string; match: string; winner: string }[]
                | undefined
            )
              ?.map((p) => `${p.stage}: ${p.match} → ${p.winner}`)
              .join("；") ?? "";
          const dark =
            (
              snapshot.darkHorses as
                | { team: string; probability: number; fifaRank: number }[]
                | undefined
            )
              ?.slice(0, 3)
              .map(
                (d) =>
                  `${d.team}(FIFA #${d.fifaRank}, ${(d.probability * 100).toFixed(1)}%)`,
              )
              .join("、") ?? "";

          systemPrompt = `你是世界杯冠军预测 AI Agent，具备专业赛事分析能力。以下是本次基于真实赛程数据的预测结构化快照：

【夺冠概率 Top5】${top}
【决赛预测】${final ? `${final.teamA} ${final.score} ${final.teamB}，冠军：${final.winner}` : "未定"}
【冠军路径】${path}
【黑马候选】${dark}
【数据来源】football-data.org 真实赛程 + Elo+泊松+蒙特卡洛模拟
${sentimentContext ? `\n${sentimentContext}` : ""}
回答规则：
- 基于以上真实数据作答，数据和结论必须一致
- 如有舆情数据，可在回答中引用平台声量作为辅助佐证（如" /微博上对X队的利好舆情较多"）
- 回答要专业、有洞察力，加入你对局势的判断
- 适度使用 **加粗** 强调关键信息
- 回答简洁有力，聚焦用户问题，不要重复完整报告
- 如用户问某支球队，结合其 Elo 评分、历史表现、模拟概率及平台舆情深度分析

${NAV_TOOLS}`;
        } else {
          systemPrompt = `你是世界杯冠军预测 AI Agent，请用中文专业回答用户关于 2026 FIFA 世界杯的问题。回答要有洞察力，适度使用 **加粗** 强调重点。\n${sentimentContext ? `\n${sentimentContext}\n` : ""}${NAV_TOOLS}`;
        }

        const qwenMessages: {
          role: "system" | "user" | "assistant";
          content: string;
        }[] = [
          { role: "system", content: systemPrompt },
          // 只保留文字对话历史（不含 meta），避免超出 token 限制
          ...history.slice(-8).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content.slice(0, 1200), // 截断超长的首条推演文本
          })),
          { role: "user", content: userMessage },
        ];

        const result = await chatWithQwen(
          qwenMessages,
          "抱歉，我暂时无法回答这个问题，请稍后再试。",
          { temperature: 0.6, maxTokens: 1000 },
        );

        await streamText(send, result.content, 3, 8);
        send({
          done: true,
          meta: { source: result.source, model: result.model },
        });
      } catch (err) {
        send({
          delta:
            "\n❌ 推演出错：" +
            (err instanceof Error ? err.message : "未知错误"),
        });
        send({ done: true, meta: {} });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
