"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import { useAppStore, type AgentChatMessage, type MatchCardPayload } from "@/lib/store";
import { getTeam } from "@/lib/data/loader";
import TaskQueue, { type Task, type TaskItem } from "@/components/agent/TaskQueue";
import MiniMarkdown from "@/components/common/MiniMarkdown";

// 解析 Qwen 插入的 [NAV:/path:label] 跳转标记
const NAV_RE = /\[NAV:([^:]+):([^\]]+)\]/g;
function parseNav(content: string) {
  const links: { path: string; label: string }[] = [];
  const clean = content.replace(NAV_RE, (_, p, l) => { links.push({ path: p.trim(), label: l.trim() }); return ""; }).trimEnd();
  return { clean, links };
}

const STAGE_LABEL: Record<string, string> = {
  r32: "32强", r16: "16强", qf: "1/4决赛", sf: "半决赛", final: "决赛",
};

function teamLabel(id: string) {
  const t = getTeam(id);
  return t ? `${t.flag} ${t.name}` : id;
}

/** 把比赛卡片数据序列化成可读的用户消息 + 系统上下文 */
function buildMatchMessage(card: MatchCardPayload): string {
  const stageStr = STAGE_LABEL[card.stage] ?? card.stage;
  const penStr = card.wentToPenalties ? "（点球大战）" : "";
  const lines = [
    `【赛事卡片分析请求】${stageStr}`,
    `${teamLabel(card.teamA)} ${card.scoreA} - ${card.scoreB} ${teamLabel(card.teamB)}${penStr}`,
    `预测冠军：${teamLabel(card.winner)}`,
    ``,
    `📊 关键数据`,
    `· Elo 差值：${card.eloDiff > 0 ? "+" : ""}${card.eloDiff.toFixed(0)}（${teamLabel(card.teamA)} ${card.eloA.toFixed(0)} vs ${teamLabel(card.teamB)} ${card.eloB.toFixed(0)}）`,
    `· 期望进球 λ：${card.lambdaA.toFixed(2)} : ${card.lambdaB.toFixed(2)}`,
    `· 胜平负概率：${(card.probWinA * 100).toFixed(1)}% / ${(card.probDraw * 100).toFixed(1)}% / ${(card.probWinB * 100).toFixed(1)}%`,
    ``,
    `🔗 模型推理链路`,
    ...card.reasoningSteps.map((s, i) => `${i + 1}. ${s}`),
  ];
  if (card.aiAnalysis) {
    lines.push(``, `🤖 Qwen 已有分析（${card.aiSource ?? "本地"}）`, card.aiAnalysis);
  }
  lines.push(``, `请基于以上数据对这场比赛给出深度解析，包括：胜负关键因素、战术博弈分析、以及该场比赛对整体冠军预测的影响。`);
  return lines.join("\n");
}

const STYLE_LABEL: Record<string, string> = {
  possession: "控球流", counter: "反击流", press: "高压流",
  defensive: "防守流", balanced: "均衡型",
};

// 完整决策数据卡片（在 FloatingAgent assistant 消息里展示）
function MatchDataCard({ card }: { card: MatchCardPayload }) {
  const stageStr = STAGE_LABEL[card.stage] ?? card.stage;
  const penStr = card.wentToPenalties ? " · 点球大战" : "";
  const tA = getTeam(card.teamA);
  const tB = getTeam(card.teamB);
  const winnerIsA = card.winner === card.teamA;

  const rows = [
    {
      label: "Elo 评分",
      a: `${card.eloA.toFixed(0)}`,
      b: `${card.eloB.toFixed(0)}`,
      detail: `差值 ${card.eloDiff > 0 ? "+" : ""}${card.eloDiff.toFixed(0)}，${winnerIsA ? tA?.name : tB?.name} 基础胜率 ${(card.eloWinProbA * 100).toFixed(1)}%`,
    },
    {
      label: "综合战力",
      a: card.strengthA.toFixed(1),
      b: card.strengthB.toFixed(1),
      detail: "攻防中场速度经验状态六维加权",
    },
    {
      label: "期望进球 λ",
      a: card.lambdaA.toFixed(2),
      b: card.lambdaB.toFixed(2),
      detail: "泊松模型（进攻/防守比×状态×主场）",
    },
    {
      label: "心情修正",
      a: `×${card.moodModA.toFixed(3)}`,
      b: `×${card.moodModB.toFixed(3)}`,
      detail: "信心/动机/压力/疲劳四维模型",
    },
    {
      label: "球风修正",
      a: `×${card.styleClashA.toFixed(2)}`,
      b: `×${card.styleClashB.toFixed(2)}`,
      detail: `${STYLE_LABEL[card.styleA] ?? card.styleA} vs ${STYLE_LABEL[card.styleB] ?? card.styleB}`,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface/80 overflow-hidden mb-2 text-left">
      {/* 标题行 */}
      <div className="px-3 py-2 bg-surface-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pitch/20 text-pitch-bright font-semibold">{stageStr}{penStr}</span>
          <span className="text-[10px] text-muted font-medium">决策链路分析</span>
        </div>
      </div>

      {/* 比分展示 */}
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <div className={`flex items-center gap-1.5 flex-1 ${winnerIsA ? "opacity-100" : "opacity-55"}`}>
          <span className="text-xl">{tA?.flag}</span>
          <div>
            <div className={`text-xs font-bold ${winnerIsA ? "text-foreground" : "text-muted"}`}>{tA?.name ?? card.teamA}</div>
            <div className="text-[9px] text-muted">{STYLE_LABEL[card.styleA] ?? card.styleA}</div>
          </div>
        </div>
        <div className="text-center shrink-0">
          <div className="font-mono font-bold text-lg leading-none">
            <span className={winnerIsA ? "text-pitch-bright" : "text-muted"}>{card.scoreA}</span>
            <span className="text-muted/50 mx-1.5">-</span>
            <span className={!winnerIsA ? "text-pitch-bright" : "text-muted"}>{card.scoreB}</span>
          </div>
          {card.wentToPenalties && <div className="text-[9px] text-amber-400 mt-0.5">点球</div>}
        </div>
        <div className={`flex items-center gap-1.5 flex-1 justify-end ${!winnerIsA ? "opacity-100" : "opacity-55"}`}>
          <div className="text-right">
            <div className={`text-xs font-bold ${!winnerIsA ? "text-foreground" : "text-muted"}`}>{tB?.name ?? card.teamB}</div>
            <div className="text-[9px] text-muted">{STYLE_LABEL[card.styleB] ?? card.styleB}</div>
          </div>
          <span className="text-xl">{tB?.flag}</span>
        </div>
      </div>

      {/* 胜平负条 */}
      <div className="px-3 pb-1">
        <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
          <div className="rounded-full bg-pitch-bright/80" style={{ width: `${card.probWinA * 100}%` }} />
          <div className="rounded-full bg-muted/25" style={{ width: `${card.probDraw * 100}%` }} />
          <div className="rounded-full bg-data/70" style={{ width: `${card.probWinB * 100}%` }} />
        </div>
        <div className="flex justify-between text-[9px] text-muted mt-0.5">
          <span>{tA?.name?.slice(0, 3)} {(card.probWinA * 100).toFixed(0)}%</span>
          <span>平 {(card.probDraw * 100).toFixed(0)}%</span>
          <span>{(card.probWinB * 100).toFixed(0)}% {tB?.name?.slice(0, 3)}</span>
        </div>
      </div>

      {/* 决策数据网格 */}
      <div className="px-3 py-2 space-y-1.5 border-t border-border/50">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-2 text-[10px]">
            <span className="text-muted w-16 shrink-0 pt-0.5">{row.label}</span>
            <div className="flex-1">
              <div className="flex gap-2 font-mono font-bold">
                <span className={winnerIsA ? "text-pitch-bright" : "text-foreground/70"}>{row.a}</span>
                <span className="text-muted/40">vs</span>
                <span className={!winnerIsA ? "text-pitch-bright" : "text-foreground/70"}>{row.b}</span>
              </div>
              <div className="text-muted/70 text-[9px] mt-0.5">{row.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 推理步骤 */}
      <div className="px-3 py-2 border-t border-border/50 space-y-1">
        <div className="text-[9px] text-muted uppercase tracking-wider font-semibold mb-1">推理链路</div>
        {card.reasoningSteps.map((step, i) => (
          <div key={i} className="flex gap-1.5 text-[10px]">
            <span className="text-pitch-bright/60 shrink-0 font-mono">{i + 1}.</span>
            <span className="text-foreground/75 leading-relaxed">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const QUICK_TASKS = ["为什么这支队最有可能夺冠？", "本届最大黑马是谁？", "决赛预测是什么？"];

let taskIdCounter = 0;
function nextTaskId() { return `t-${++taskIdCounter}`; }

export default function FloatingAgent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // 任务队列（含状态，用于 TaskQueue 组件展示）
  const [tasks, setTasks] = useState<Task[]>([]);
  const queueRef = useRef<TaskItem[]>([]);
  const loadingRef = useRef(false);
  const currentTaskIdRef = useRef<string | null>(null);

  // 与 /agent 页面共享同一份消息状态
  const messages = useAppStore((s) => s.agentMessages);
  const setMessages = useAppStore((s) => s.setAgentMessages);
  const agentInitialized = useAppStore((s) => s.agentInitialized);
  const pendingMatchCard = useAppStore((s) => s.pendingMatchCard);
  const clearPendingMatchCard = useAppStore((s) => s.clearPendingMatchCard);

  const bottomRef = useRef<HTMLDivElement>(null);

  /** 把一个 TaskItem 标记为 running，更新 tasks 列表 */
  const markRunning = (id: string) => {
    currentTaskIdRef.current = id;
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "running" } : t));
  };

  /** 把当前 running 任务标记为 done */
  const markDone = () => {
    const id = currentTaskIdRef.current;
    if (!id) return;
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "done" } : t));
    // 1 秒后从列表移除已完成任务（保留短暂的 done 视觉反馈）
    setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }, 1000);
    currentTaskIdRef.current = null;
  };

  /** 入队一条消息，如果当前没有请求在跑则立即发送，否则排队等待 */
  const enqueue = (item: TaskItem) => {
    const id = nextTaskId();
    if (!loadingRef.current) {
      // 直接发，状态直接 running
      setTasks((prev) => [...prev, { id, item, status: "running" }]);
      currentTaskIdRef.current = id;
      if (item.type === "text") _sendMessage(item.content);
      else _sendMatchAnalysis(item.card);
    } else {
      // 排队等待
      queueRef.current = [...queueRef.current, { ...item, _id: id } as TaskItem & { _id: string }];
      setTasks((prev) => [...prev, { id, item, status: "pending" }]);
    }
  };

  /** 当前请求完成后标记 done，并取出队列里的下一条 */
  const drainQueue = () => {
    markDone(); // 先标记当前任务完成
    if (queueRef.current.length === 0) return;
    const [next, ...rest] = queueRef.current as (TaskItem & { _id: string })[];
    queueRef.current = rest;
    const id = next._id;
    markRunning(id);
    if (next.type === "text") _sendMessage(next.content);
    else _sendMatchAnalysis(next.card);
  };

  // 监听 bracket 页面发来的比赛卡片，自动打开并入队
  useEffect(() => {
    if (!pendingMatchCard) return;
    clearPendingMatchCard();
    setOpen(true);
    enqueue({ type: "match", card: pendingMatchCard });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMatchCard]);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [open, messages]);

  // 在 /agent 或首页（/）不显示悬浮球
  if (pathname === "/agent" || pathname === "/") return null;

  /** 比赛卡片专用：直接以 assistant 身份插入卡片+流式 Qwen 分析 */
  const _sendMatchAnalysis = async (card: MatchCardPayload) => {
    loadingRef.current = true;
    setLoading(true);

    // 直接插入 assistant 占位（含 matchCard meta，供渲染卡片）
    const assistantMsg: AgentChatMessage = {
      role: "assistant",
      content: "",
      streaming: true,
      meta: { matchCard: card },
    };
    setMessages((prev) => [...prev, assistantMsg]);

    // 构造给 Qwen 的 prompt（用最新消息列表，避免闭包过期）
    const prompt = buildMatchMessage(card);
    const currentMessages = useAppStore.getState().agentMessages;
    const historyForQwen = [...currentMessages, { role: "user" as const, content: prompt }];

    try {
      const res = await fetch(apiUrl("/api/agent/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForQwen, isFirstRun: false }),
      });
      if (!res.ok || !res.body) throw new Error("请求失败");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let meta: AgentChatMessage["meta"] = { matchCard: card };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.delta) {
              fullContent += json.delta;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: fullContent, streaming: true, meta };
                return next;
              });
            }
            if (json.done && json.meta) meta = { ...json.meta, matchCard: card };
          } catch { /* ignore */ }
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: fullContent, streaming: false, meta };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "❌ 分析失败：" + (err instanceof Error ? err.message : "未知错误"),
          streaming: false,
          meta: { matchCard: card },
        };
        return next;
      });
    } finally {
      loadingRef.current = false;
      setLoading(false);
      drainQueue(); // drainQueue 内部调 markDone
    }
  };

  const sendMessage = (text: string) => {
    const content = text.trim();
    if (!content) return;
    setInput("");
    setOpen(true);
    enqueue({ type: "text", content });
  };

  const _sendMessage = async (content: string) => {
    loadingRef.current = true;
    setLoading(true);

    // 用最新消息列表（避免闭包过期）
    const currentMessages = useAppStore.getState().agentMessages;
    const userMsg: AgentChatMessage = { role: "user", content };
    const newHistory = [...currentMessages, userMsg];
    setMessages(newHistory);

    const placeholder: AgentChatMessage = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, placeholder]);

    try {
      const res = await fetch(apiUrl("/api/agent/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory, isFirstRun: false }),
      });
      if (!res.ok || !res.body) throw new Error("请求失败");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let meta: AgentChatMessage["meta"] = undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.delta) {
              fullContent += json.delta;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: fullContent, streaming: true, meta };
                return next;
              });
            }
            if (json.done) meta = json.meta;
          } catch { /* ignore */ }
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: fullContent, streaming: false, meta };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "抱歉，请求失败：" + (err instanceof Error ? err.message : "未知错误"),
          streaming: false,
        };
        return next;
      });
    } finally {
      loadingRef.current = false;
      setLoading(false);
      drainQueue();
    }
  };

  // 未初始化时（agent 页面还没跑过预测），消息列表的提示文案
  const isEmpty = messages.length === 0;

  return (
    <div className="fixed bottom-5 right-5 z-70">
      {open && (
        <div className="mb-3 w-[calc(100vw-2.5rem)] max-w-[400px] overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl flex flex-col" style={{ maxHeight: "70vh" }}>
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
            <div>
              <div className="text-sm font-bold">世界杯预测 Agent</div>
              <div className="text-[10px] text-muted">
                {agentInitialized ? "与 /agent 页面实时同步" : "前往 Agent 页面开始预测"}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
              aria-label="关闭"
            >
              ×
            </button>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {isEmpty ? (
              <div className="text-center py-6 text-muted text-xs space-y-2">
                <div className="text-3xl">⚽</div>
                <div>尚未运行预测，</div>
                <Link href="/agent" className="text-data-bright underline" onClick={() => setOpen(false)}>
                  前往预测 Agent 页面 →
                </Link>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={msg.role === "user" ? "text-right" : "text-left"}>

                  {/* assistant 消息：带 matchCard 时先展示完整决策卡片 */}
                  {msg.role === "assistant" && msg.meta?.matchCard && (
                    <div className="max-w-[96%]">
                      <MatchDataCard card={msg.meta.matchCard as MatchCardPayload} />
                    </div>
                  )}

                  {/* 消息气泡 */}
                  {(msg.role === "user" || msg.content || msg.streaming) && (() => {
                    const { clean, links } = msg.role === "assistant" && !msg.streaming
                      ? parseNav(msg.content) : { clean: msg.content, links: [] };
                    if (msg.role === "assistant" && msg.meta?.matchCard && !msg.content && !msg.streaming) return null;
                    const isAssistant = msg.role === "assistant";
                    const hasMatchCard = !!msg.meta?.matchCard;

                    return (
                      <div
                        className={`rounded-2xl px-3 py-2 text-xs ${
                          !isAssistant
                            ? "inline-block max-w-[96%] bg-pitch/20 border border-pitch/30 text-foreground leading-relaxed"
                            : hasMatchCard
                              ? "bg-surface-2/60 border border-border/40 text-foreground w-full"
                              : "bg-surface-2 text-foreground w-full"
                        }`}
                      >
                        {isAssistant && clean ? (
                          <MiniMarkdown content={clean} compact />
                        ) : (
                          <span className="whitespace-pre-line">{clean}</span>
                        )}
                        {msg.streaming && (
                          <span className="inline-block w-0.5 h-3 bg-pitch-bright ml-0.5 animate-pulse align-middle" />
                        )}
                        {links.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/10">
                            {links.map((l) => (
                              <Link key={l.path} href={l.path}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-data/15 border border-data/30 text-data-bright hover:bg-data/25 transition-all">
                                → {l.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 显示首条回复的夺冠 Top3 */}
                  {msg.role === "assistant" && !msg.streaming && msg.meta?.topChampions && (
                    <div className="mt-1.5 inline-block max-w-[96%] rounded-xl border border-border bg-surface/60 px-3 py-2 text-left">
                      <div className="text-[10px] text-muted mb-1">夺冠概率 Top 3</div>
                      {(msg.meta.topChampions as { team: string; probability: number }[]).slice(0, 3).map((c, i) => (
                        <div key={c.team} className="flex justify-between gap-3 text-[11px]">
                          <span className="text-muted">{i + 1}. {c.team}</span>
                          <span className="font-mono text-pitch-bright">{(c.probability * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 舆情快照摘要 */}
                  {msg.role === "assistant" && !msg.streaming && msg.meta?.sentimentSnapshot &&
                    (() => {
                      const snap = msg.meta.sentimentSnapshot as { total: number; teams: { teamId: string; net: number }[] };
                      if (!snap || snap.teams.length === 0) return null;
                      const top3 = snap.teams.slice(0, 3);
                      return (
                        <div className="mt-1.5 max-w-[96%] rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-violet-300">📡 舆情快照 · {snap.total} 条</span>
                            <a href="/data" className="text-[9px] text-violet-400/70 hover:text-violet-300">详情 →</a>
                          </div>
                          {top3.map((t) => (
                            <div key={t.teamId} className="flex justify-between text-[10px]">
                              <span className="text-muted/70">{t.teamId}</span>
                              <span className={t.net > 0 ? "text-pitch-bright" : t.net < 0 ? "text-red-400" : "text-muted"}>
                                {t.net > 0 ? "📈" : t.net < 0 ? "📉" : "➡️"} {t.net > 0 ? "+" : ""}{t.net}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  }
                </div>
              ))
            )}
            {loading && (
              <div className="rounded-2xl bg-surface-2 px-3 py-2 text-xs text-muted flex items-center gap-2">
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-pitch-bright animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 rounded-full bg-pitch-bright animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 rounded-full bg-pitch-bright animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
                AI 分析中…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 任务队列 TodoList */}
          {tasks.length > 0 && (
            <div className="px-3 pt-2 shrink-0">
              <TaskQueue tasks={tasks} maxVisible={4} />
            </div>
          )}

          {/* 快捷 + 输入 */}
          <div className="border-t border-border px-4 py-3 shrink-0">
            {!isEmpty && tasks.length === 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK_TASKS.map((task) => (
                  <button
                    key={task}
                    onClick={() => sendMessage(task)}
                    disabled={loading}
                    className="rounded-full bg-surface-2 border border-border px-2.5 py-1 text-[10px] text-muted hover:text-foreground hover:border-pitch/40 disabled:opacity-50 transition-all"
                  >
                    {task}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!agentInitialized}
                placeholder={
                  !agentInitialized
                    ? "请先前往 Agent 页面运行预测"
                    : loading
                      ? "AI 分析中，输入内容将自动排队…"
                      : "追问任何世界杯问题…"
                }
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-pitch disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || !agentInitialized}
                className="rounded-xl bg-pitch-bright px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
              >
                {loading ? "排队" : "发送"}
              </button>
            </form>
            <Link
              href="/agent"
              onClick={() => setOpen(false)}
              className="mt-2 block text-right text-[10px] text-data-bright hover:text-data transition-colors"
            >
              打开完整 Agent 页面 →
            </Link>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 items-center gap-2 rounded-full border border-pitch/30 bg-linear-to-r from-pitch to-data px-4 text-sm font-bold text-white shadow-2xl shadow-pitch/20 hover:brightness-110 transition-all"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs">AI</span>
        世界杯 Agent
        {/* 有消息时显示状态圆点 */}
        {agentInitialized && (
          <span className="w-2 h-2 rounded-full bg-pitch-bright animate-pulse-soft" />
        )}
      </button>
    </div>
  );
}
