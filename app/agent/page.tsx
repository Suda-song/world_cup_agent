"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/basePath";
import { useAppStore, type AgentChatMessage } from "@/lib/store";

const QUICK_QUESTIONS = [
  "为什么这支队最有可能夺冠？",
  "本届最大黑马是谁？",
  "决赛会是哪两支队，理由是什么？",
  "小组赛有哪些关键出线情况？",
  "r16 阶段有哪些值得关注的对阵？",
];

const STAGE_LABELS: Record<string, string> = {
  r32: "32强",
  r16: "16强",
  qf: "四分之一决赛",
  sf: "半决赛",
  final: "决赛",
  group: "小组赛",
};

const STAGE_COLORS: Record<string, string> = {
  r32: "border-zinc-600/50 bg-zinc-800/30",
  r16: "border-blue-500/30 bg-blue-900/20",
  qf: "border-violet-500/30 bg-violet-900/20",
  sf: "border-amber-500/30 bg-amber-900/20",
  final: "border-pitch/50 bg-pitch/10",
};

type ChampionPathItem = { stage: string; match: string; winner: string; state: string };
type TopChampion = { team: string; probability: number };
type DarkHorse = { team: string; probability: number; fifaRank: number };
type FinalPrediction = { teamA: string; teamB: string; score: string; winner: string } | null;

function ChampionPathCard({ path }: { path: ChampionPathItem[] }) {
  const stageOrder = ["r32", "r16", "qf", "sf", "final"];
  const grouped: Record<string, ChampionPathItem[]> = {};
  for (const m of path) {
    if (!grouped[m.stage]) grouped[m.stage] = [];
    grouped[m.stage].push(m);
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface/60 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-bold text-pitch-bright">🏆 冠军晋级路径</span>
        <Link
          href="/bracket"
          className="text-[10px] text-data hover:text-data-bright transition-colors flex items-center gap-1"
        >
          查看完整对阵图 →
        </Link>
      </div>
      <div className="p-3 space-y-1.5">
        {stageOrder.filter((s) => grouped[s]).map((stage) =>
          grouped[stage].map((m, i) => (
            <div
              key={`${stage}-${i}`}
              className={`rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2 ${STAGE_COLORS[stage] ?? "border-border"}`}
            >
              <span className="text-muted shrink-0 w-20">{STAGE_LABELS[stage] ?? stage}</span>
              <span className="flex-1 font-mono text-[11px] truncate">{m.match}</span>
              <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${
                m.state === "finished"
                  ? "bg-pitch/20 text-pitch-bright"
                  : "bg-violet-500/20 text-violet-300"
              }`}>
                {m.state === "finished" ? "真实赛果" : "模型预测"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatsPanel({
  topChampions,
  finalPrediction,
  darkHorses,
}: {
  topChampions: TopChampion[];
  finalPrediction: FinalPrediction;
  darkHorses: DarkHorse[];
}) {
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
      {/* 夺冠热门 */}
      <div className="rounded-xl border border-border bg-surface/60 p-3">
        <div className="text-[10px] text-muted uppercase tracking-wider mb-2">📈 夺冠概率 Top 5</div>
        {topChampions.slice(0, 5).map((c, i) => (
          <div key={c.team} className="flex items-center gap-2 py-0.5">
            <span className="text-[10px] text-muted w-4 text-right">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs truncate">{c.team}</div>
              <div
                className="h-0.5 rounded-full mt-0.5 bg-pitch-bright/40"
                style={{ width: `${(c.probability / (topChampions[0]?.probability ?? 1)) * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-pitch-bright shrink-0">
              {(c.probability * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* 决赛预测 */}
      {finalPrediction && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-2">🏆 决赛预测</div>
          <div className="text-sm font-bold">{finalPrediction.teamA}</div>
          <div className="text-2xl font-mono font-black text-amber-400 my-1">{finalPrediction.score}</div>
          <div className="text-sm font-bold">{finalPrediction.teamB}</div>
          <div className="mt-2 text-[11px] px-2 py-1 rounded-full bg-pitch/20 text-pitch-bright font-semibold">
            冠军：{finalPrediction.winner}
          </div>
        </div>
      )}

      {/* 黑马 */}
      {darkHorses.length > 0 && (
        <div className="rounded-xl border border-warn/20 bg-warn/5 p-3">
          <div className="text-[10px] text-warn uppercase tracking-wider mb-2">💣 最具潜力黑马</div>
          {darkHorses.slice(0, 3).map((d) => (
            <div key={d.team} className="py-1.5 border-b border-warn/10 last:border-0">
              <div className="text-xs font-medium">{d.team}</div>
              <div className="text-[10px] text-muted mt-0.5">
                FIFA #{d.fifaRank} · 夺冠概率 {(d.probability * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReasoningChain({ steps }: { steps: string[] }) {
  return (
    <div className="mt-3 rounded-xl border border-data/20 bg-data/5 p-3">
      <div className="text-[10px] text-data-bright uppercase tracking-wider mb-2">🔗 推理链路</div>
      <div className="space-y-1">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px] text-muted">
            <span className="shrink-0 w-4 h-4 rounded-full bg-data/20 text-data-bright flex items-center justify-center text-[9px] mt-0.5">
              {i + 1}
            </span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentPage() {
  const messages = useAppStore((s) => s.agentMessages);
  const setMessages = useAppStore((s) => s.setAgentMessages);
  const agentInitialized = useAppStore((s) => s.agentInitialized);
  const setAgentInitialized = useAppStore((s) => s.setAgentInitialized);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!agentInitialized) {
      setAgentInitialized(true);
      triggerChat([], true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerChat = async (history: AgentChatMessage[], isFirstRun = false) => {
    setLoading(true);
    const placeholder: AgentChatMessage = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, placeholder]);

    try {
      const res = await fetch(apiUrl("/api/agent/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, isFirstRun }),
      });

      if (!res.ok || !res.body) throw new Error("请求失败");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let meta: AgentChatMessage["meta"] = undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
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
            if (json.done) {
              meta = json.meta;
            }
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
          content: "抱歉，预测服务暂时不可用：" + (err instanceof Error ? err.message : "未知错误"),
          streaming: false,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: AgentChatMessage = { role: "user", content };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    await triggerChat(newHistory, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen max-h-screen">
      {/* 顶部栏 */}
      <div className="shrink-0 px-6 py-3 border-b border-border bg-surface/80 backdrop-blur-xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-linear-to-br from-pitch-bright to-data flex items-center justify-center text-sm">⚽</div>
        <div>
          <div className="font-bold text-sm leading-tight">世界杯冠军预测 Agent</div>
          <div className="text-[10px] text-muted">数据采集 · 赛程推演 · 比分预测 · AI 分析</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/bracket" className="hidden sm:flex items-center gap-1.5 text-[11px] text-data hover:text-data-bright transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/>
            </svg>
            赛程对阵图
          </Link>
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-pitch-bright animate-pulse-soft" />
            引擎在线
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">🏆</div>
            <div className="text-xl font-bold mb-2">世界杯冠军预测 Agent</div>
            <div className="text-sm text-muted mb-1">正在采集真实赛程数据，运行推演模型…</div>
            <div className="text-xs text-muted/60">Elo + 泊松进球 + 蒙特卡洛模拟 + Qwen AI 分析</div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-pitch-bright to-data flex items-center justify-center text-sm shrink-0 mt-1">⚽</div>
            )}

            <div className={`${msg.role === "user" ? "max-w-[75%] order-first" : "max-w-[85%] w-full"}`}>
              {/* 消息气泡 */}
              <div className={`rounded-2xl px-4 py-3 text-sm leading-7 whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-pitch/20 border border-pitch/30 text-foreground rounded-tr-sm"
                  : "bg-surface border border-border text-foreground rounded-tl-sm font-mono text-[13px]"
              }`}>
                {msg.content}
                {msg.streaming && (
                  <span className="inline-block w-0.5 h-4 bg-pitch-bright ml-0.5 animate-pulse align-middle" />
                )}
              </div>

              {/* 首条 assistant 回复完成后渲染结构化卡片 */}
              {msg.role === "assistant" && !msg.streaming && msg.meta && (
                <div className="mt-1">
                  {/* 数据统计面板 */}
                  {msg.meta.topChampions && (
                    <StatsPanel
                      topChampions={msg.meta.topChampions as TopChampion[]}
                      finalPrediction={msg.meta.finalPrediction as FinalPrediction}
                      darkHorses={(msg.meta.darkHorses ?? []) as DarkHorse[]}
                    />
                  )}

                  {/* 冠军路径 */}
                  {msg.meta.championPath && (msg.meta.championPath as ChampionPathItem[]).length > 0 && (
                    <ChampionPathCard path={msg.meta.championPath as ChampionPathItem[]} />
                  )}

                  {/* 推理链路 */}
                  {msg.meta.reasoningChain && (msg.meta.reasoningChain as string[]).length > 0 && (
                    <ReasoningChain steps={msg.meta.reasoningChain as string[]} />
                  )}

                  {/* 模型信息 */}
                  {msg.meta.model && (
                    <div className="mt-2 flex items-center justify-between px-1">
                      <div className="text-[10px] text-muted">
                        {msg.meta.model} · {msg.meta.reportSource === "qwen" ? "Qwen AI 生成" : "本地模板"}
                      </div>
                      <Link href="/bracket" className="text-[10px] text-data hover:text-data-bright transition-colors">
                        查看完整赛程对阵图 →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* 多轮对话回复的模型信息 */}
              {msg.role === "assistant" && !msg.streaming && msg.meta?.model && !msg.meta?.topChampions && (
                <div className="mt-1 text-[10px] text-muted px-1">
                  {msg.meta.model} · {msg.meta.source === "qwen" ? "Qwen AI 生成" : "本地模板"}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-sm shrink-0 mt-1">👤</div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* 快捷问题 */}
      {messages.length > 0 && !loading && (
        <div className="shrink-0 px-4 pb-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-surface-2 border border-border text-muted hover:text-foreground hover:border-pitch/40 transition-all whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <div className="shrink-0 px-4 pb-4 pt-2 border-t border-border bg-surface/80 backdrop-blur-xl">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            placeholder={loading ? "Agent 正在推演…" : "追问任何关于世界杯的问题…"}
            className="flex-1 resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-pitch/60 transition-colors disabled:opacity-50 max-h-32"
            style={{ scrollbarWidth: "none" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-2xl bg-pitch-bright text-black flex items-center justify-center hover:bg-pitch transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        </div>
        <div className="text-center text-[10px] text-muted/50 mt-2">Enter 发送 · Shift+Enter 换行</div>
      </div>
    </div>
  );
}
