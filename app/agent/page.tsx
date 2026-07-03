"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/basePath";
import { useAppStore, type AgentChatMessage } from "@/lib/store";
import type { MonteCarloResult } from "@/lib/prediction/monteCarlo";
import MiniMarkdown from "@/components/common/MiniMarkdown";

// ─── 类型 ────────────────────────────────────────────
type ChampionPathItem = { stage: string; match: string; winner: string; state: string };
type TopChampion = { team: string; probability: number };
type DarkHorse = { team: string; probability: number; fifaRank: number };
type FinalPrediction = { teamA: string; teamB: string; score: string; winner: string } | null;

const QUICK_QUESTIONS = [
  "为什么这支队最有可能夺冠？",
  "本届最大黑马是谁？",
  "决赛会是哪两支队，理由是什么？",
  "小组赛有哪些关键出线情况？",
  "16强阶段有哪些值得关注的对阵？",
  "分析冠军路径中最危险的一场",
];

const STAGE_META: Record<string, { label: string; color: string; icon: string }> = {
  r32: { label: "32强", color: "border-zinc-600/50 bg-zinc-800/30 text-zinc-300", icon: "⚔️" },
  r16: { label: "16强", color: "border-blue-500/30 bg-blue-900/20 text-blue-300", icon: "⚔️" },
  qf:  { label: "四分之一决赛", color: "border-violet-500/30 bg-violet-900/20 text-violet-300", icon: "🔥" },
  sf:  { label: "半决赛", color: "border-amber-500/30 bg-amber-900/20 text-amber-300", icon: "🏟️" },
  final: { label: "决赛", color: "border-pitch/50 bg-pitch/10 text-pitch-bright", icon: "🏆" },
};

// ─── 子组件 ──────────────────────────────────────────

function StatsPanel({ topChampions, finalPrediction, darkHorses }: {
  topChampions: TopChampion[];
  finalPrediction: FinalPrediction;
  darkHorses: DarkHorse[];
}) {
  const max = topChampions[0]?.probability ?? 1;
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
      {/* 夺冠热门 */}
      <div className="rounded-xl border border-border bg-surface/60 p-3">
        <div className="text-[10px] text-muted uppercase tracking-wider mb-2.5 flex items-center gap-1">
          <span>📈</span> 夺冠概率 Top 5
        </div>
        {topChampions.slice(0, 5).map((c, i) => (
          <div key={c.team} className="flex items-center gap-2 py-0.5 group">
            <span className="text-[10px] text-muted w-4 text-right shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs truncate group-hover:text-foreground transition-colors">{c.team}</div>
              <div className="h-1 rounded-full mt-0.5 overflow-hidden bg-surface-2">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(c.probability / max) * 100}%`,
                    background: i === 0 ? "linear-gradient(90deg,#fbbf24,#f97316)"
                      : i < 3 ? "linear-gradient(90deg,#34d399,#10b981)"
                      : "linear-gradient(90deg,#38bdf8,#0ea5e9)",
                  }}
                />
              </div>
            </div>
            <span className="text-xs font-mono text-pitch-bright shrink-0">{(c.probability * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {/* 决赛预测 */}
      {finalPrediction && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.06)_0%,transparent_70%)]" />
          <div className="relative">
            <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-2">🏆 决赛预测</div>
            <div className="text-sm font-bold">{finalPrediction.teamA}</div>
            <div className="text-3xl font-mono font-black text-amber-400 my-2 tabular-nums">{finalPrediction.score}</div>
            <div className="text-sm font-bold">{finalPrediction.teamB}</div>
            <div className="mt-3 text-[11px] px-3 py-1 rounded-full bg-pitch/20 text-pitch-bright font-semibold inline-block">
              冠军 · {finalPrediction.winner}
            </div>
          </div>
        </div>
      )}

      {/* 黑马 */}
      {darkHorses.length > 0 && (
        <div className="rounded-xl border border-warn/20 bg-warn/5 p-3">
          <div className="text-[10px] text-warn uppercase tracking-wider mb-2.5 flex items-center gap-1">
            <span>💣</span> 最具潜力黑马
          </div>
          {darkHorses.slice(0, 3).map((d, i) => (
            <div key={d.team} className={`py-2 ${i < darkHorses.slice(0, 3).length - 1 ? "border-b border-warn/10" : ""}`}>
              <div className="text-xs font-medium">{d.team}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted">FIFA #{d.fifaRank}</span>
                <span className="text-[10px] font-mono text-warn">{(d.probability * 100).toFixed(1)}% 夺冠</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChampionPathCard({ path }: { path: ChampionPathItem[] }) {
  const stageOrder = ["r32", "r16", "qf", "sf", "final"];
  const grouped: Record<string, ChampionPathItem[]> = {};
  for (const m of path) {
    if (!grouped[m.stage]) grouped[m.stage] = [];
    grouped[m.stage].push(m);
  }
  const stages = stageOrder.filter((s) => grouped[s]);

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface/60 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-bold text-pitch-bright">🏆 冠军晋级路径</span>
        <Link href="/bracket" className="text-[10px] text-data hover:text-data-bright transition-colors flex items-center gap-1">
          完整对阵图 →
        </Link>
      </div>
      {/* 横向时间轴 */}
      <div className="p-3 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {stages.map((stage, si) => {
          const meta = STAGE_META[stage] ?? { label: stage, color: "border-border", icon: "⚔️" };
          return (
            <div key={stage} className="flex items-center gap-1.5 shrink-0">
              <div className={`rounded-lg border px-3 py-2 min-w-[120px] ${meta.color}`}>
                <div className="text-[10px] font-bold mb-1">{meta.icon} {meta.label}</div>
                {grouped[stage].map((m, i) => (
                  <div key={i} className="text-[10px] leading-5">
                    <span className="font-mono">{m.match.replace(" — ", "\n→ ")}</span>
                    <div className={`text-[9px] mt-0.5 ${m.state === "finished" ? "text-pitch-bright" : "text-violet-400"}`}>
                      {m.state === "finished" ? "✅ 真实" : "🔮 预测"}
                    </div>
                  </div>
                ))}
              </div>
              {si < stages.length - 1 && (
                <span className="text-muted text-xs shrink-0">›</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReasoningChain({ steps }: { steps: string[] }) {
  return (
    <div className="mt-3 rounded-xl border border-data/20 bg-data/5 p-3">
      <div className="text-[10px] text-data-bright uppercase tracking-wider mb-2">🔗 推理链路</div>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="w-4 h-4 rounded-full bg-data/20 text-data-bright flex items-center justify-center text-[9px] shrink-0 font-bold">{i + 1}</span>
            <span className="max-w-[200px]">{step}</span>
            {i < steps.length - 1 && <span className="text-border">›</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NAV 标记解析 ────────────────────────────────────
// Qwen 可在回复末尾加 [NAV:/path:按钮文字] 触发跳转建议
const NAV_RE = /\[NAV:([^:]+):([^\]]+)\]/g;

function parseNavTags(content: string): {
  cleanContent: string;
  navLinks: { path: string; label: string }[];
} {
  const navLinks: { path: string; label: string }[] = [];
  const cleanContent = content.replace(NAV_RE, (_, path, label) => {
    navLinks.push({ path: path.trim(), label: label.trim() });
    return "";
  }).trimEnd();
  return { cleanContent, navLinks };
}

function NavButtons({ links }: { links: { path: string; label: string }[] }) {
  if (!links.length) return null;
  const PAGE_ICONS: Record<string, string> = {
    "/bracket": "🏆",
    "/predict": "📊",
    "/dashboard": "📈",
    "/matchup": "⚔️",
    "/mood": "🧠",
    "/data": "📁",
    "/relationships": "🕸",
  };
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {links.map((l) => (
        <Link
          key={l.path}
          href={l.path}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-data/40 bg-data/10 text-data-bright hover:bg-data/20 hover:border-data/60 transition-all"
        >
          <span>{PAGE_ICONS[l.path] ?? "→"}</span>
          {l.label}
        </Link>
      ))}
    </div>
  );
}

// ─── 进度指示器（首次推演时显示） ────────────────────
const RUN_STAGES = [
  { key: "fetch", label: "采集真实赛程", icon: "🌐" },
  { key: "sim",   label: "蒙特卡洛模拟", icon: "⚙️" },
  { key: "group", label: "小组赛分析",   icon: "📊" },
  { key: "ko",    label: "淘汰赛推演",   icon: "⚔️" },
  { key: "ai",    label: "AI 深度分析",  icon: "🤖" },
];

function RunProgress({ content }: { content: string }) {
  const active = content.includes("蒙特卡洛") ? 1
    : content.includes("小组赛") ? 2
    : content.includes("32强") || content.includes("16强") ? 3
    : content.includes("Qwen AI") || content.includes("深度分析") ? 4
    : 0;
  return (
    <div className="flex items-center gap-1 flex-wrap mb-3">
      {RUN_STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all duration-500 ${
            i < active ? "bg-pitch/20 text-pitch-bright"
            : i === active ? "bg-data/20 text-data-bright animate-pulse"
            : "bg-surface-2 text-muted/50"
          }`}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </div>
          {i < RUN_STAGES.length - 1 && <span className="text-border text-[10px]">›</span>}
        </div>
      ))}
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────
export default function AgentPage() {
  const messages = useAppStore((s) => s.agentMessages);
  const setMessages = useAppStore((s) => s.setAgentMessages);
  const agentInitialized = useAppStore((s) => s.agentInitialized);
  const setAgentInitialized = useAppStore((s) => s.setAgentInitialized);
  const setMcResult = useAppStore((s) => s.setMcResult);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

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

      // Agent 跑完后把 topChampions 写进 store，其他页面（晋级预测、仪表盘）直接消费，不再重复模拟
      if (isFirstRun && meta?.topChampions) {
        const top = meta.topChampions as { team: string; probability: number; teamId?: string }[];
        const mcSnapshot: MonteCarloResult = {
          n: 3000,
          topChampions: top.map((c, i) => ({
            teamId: c.teamId ?? c.team,
            count: Math.round(c.probability * 3000),
            pct: c.probability,
          })),
          championCounts: Object.fromEntries(top.map((c) => [c.teamId ?? c.team, Math.round(c.probability * 3000)])),
          runnerUpCounts: {},
          finalCounts: {},
          probabilities: [],
        };
        setMcResult(mcSnapshot);
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "❌ 推演出错：" + (err instanceof Error ? err.message : "未知错误"),
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // 判断是否是首条推演消息（isFirstRun 产生的）
  const isFirstMsg = (idx: number) => idx === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen max-h-screen">
      {/* 顶部栏 */}
      <div className="shrink-0 px-5 py-3 border-b border-border bg-surface/80 backdrop-blur-xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-linear-to-br from-pitch-bright to-data flex items-center justify-center text-sm">⚽</div>
        <div>
          <div className="font-bold text-sm leading-tight">世界杯冠军预测 Agent</div>
          <div className="text-[10px] text-muted">数据采集 · 赛程推演 · 比分预测 · Qwen AI 分析</div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/bracket" className="hidden sm:flex items-center gap-1 text-[11px] text-data hover:text-data-bright transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="text-7xl animate-bounce-slow">🏆</div>
            <div className="text-xl font-bold">世界杯冠军预测 Agent</div>
            <div className="text-sm text-muted">正在采集真实赛程数据，运行推演模型…</div>
            <div className="flex gap-1.5 mt-1">
              {["Elo", "泊松", "蒙特卡洛", "Qwen AI"].map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 border border-border text-muted">{t}</span>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-pitch-bright to-data flex items-center justify-center text-sm shrink-0 mt-1">⚽</div>
            )}

            <div className={`${msg.role === "user" ? "max-w-[72%] order-first" : "max-w-[88%] w-full"}`}>
              {/* 首次推演时显示进度指示器 */}
              {msg.role === "assistant" && msg.streaming && isFirstMsg(idx) && (
                <RunProgress content={msg.content} />
              )}

              {/* 消息气泡 */}
              {(() => {
                const { cleanContent, navLinks } = msg.role === "assistant" && !msg.streaming
                  ? parseNavTags(msg.content)
                  : { cleanContent: msg.content, navLinks: [] };
                return (
                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-pitch/20 border border-pitch/30 text-foreground rounded-tr-sm text-sm"
                      : "bg-surface border border-border text-foreground rounded-tl-sm"
                  }`}>
                    {msg.role === "user" ? (
                      <span className="text-sm leading-7">{msg.content}</span>
                    ) : (
                      <MiniMarkdown content={cleanContent} />
                    )}
                    {msg.streaming && (
                      <span className="inline-block w-0.5 h-4 bg-pitch-bright ml-0.5 animate-pulse align-middle" />
                    )}
                    {/* 导航跳转按钮 */}
                    <NavButtons links={navLinks} />
                  </div>
                );
              })()}

              {/* 结构化卡片（首次推演完成后） */}
              {msg.role === "assistant" && !msg.streaming && msg.meta && (
                <div className="mt-1 space-y-0">
                  {msg.meta.topChampions && (
                    <StatsPanel
                      topChampions={msg.meta.topChampions as TopChampion[]}
                      finalPrediction={msg.meta.finalPrediction as FinalPrediction}
                      darkHorses={(msg.meta.darkHorses ?? []) as DarkHorse[]}
                    />
                  )}
                  {msg.meta.championPath && (msg.meta.championPath as ChampionPathItem[]).length > 0 && (
                    <ChampionPathCard path={msg.meta.championPath as ChampionPathItem[]} />
                  )}
                  {msg.meta.reasoningChain && (msg.meta.reasoningChain as string[]).length > 0 && (
                    <ReasoningChain steps={msg.meta.reasoningChain as string[]} />
                  )}
                  <div className="flex items-center justify-between px-1 mt-2">
                    <div className="text-[10px] text-muted">
                      {msg.meta.model && `${msg.meta.model} · `}
                      {msg.meta.reportSource === "qwen" ? "Qwen AI 生成" : "本地模板"}
                    </div>
                    <Link href="/bracket" className="text-[10px] text-data hover:text-data-bright transition-colors">
                      查看完整赛程对阵图 →
                    </Link>
                  </div>
                </div>
              )}

              {/* 多轮回复模型信息 */}
              {msg.role === "assistant" && !msg.streaming && msg.meta?.model && !msg.meta?.topChampions && (
                <div className="mt-1 text-[10px] text-muted px-1">{msg.meta.model} · Qwen AI</div>
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
        <div className="shrink-0 px-4 pb-1 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {QUICK_QUESTIONS.map((q) => (
            <button key={q} onClick={() => sendMessage(q)}
              className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-surface-2 border border-border text-muted hover:text-foreground hover:border-pitch/40 transition-all whitespace-nowrap">
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
