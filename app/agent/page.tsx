"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/basePath";
import { useAppStore, type AgentChatMessage } from "@/lib/store";
import type { MonteCarloResult } from "@/lib/prediction/monteCarlo";
import MiniMarkdown from "@/components/common/MiniMarkdown";
import TaskQueue, { type Task } from "@/components/agent/TaskQueue";

// ─── 类型 ────────────────────────────────────────────
type ChampionPathItem = { stage: string; match: string; winner: string; state: string };
type TopChampion = { team: string; probability: number };
type DarkHorse = { team: string; probability: number; fifaRank: number };
type FinalPrediction = { teamA: string; teamB: string; score: string; winner: string } | null;
type SentimentTeam = { teamId: string; pos: number; neg: number; neu: number; net: number; topSnippet: string; sources: string[] };
type SentimentSnapshot = { total: number; teams: SentimentTeam[]; generalNotes: string[] };

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
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
            <span>📈</span> 夺冠概率 Top 5
          </div>
          <span className="text-[9px] text-muted/50">蒙特卡洛</span>
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
            <div className="mt-2 text-[9px] text-amber-400/60">最优路径推演 · 非概率排名</div>
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

function SentimentPanel({ snap }: { snap: SentimentSnapshot }) {
  const bullish = snap.teams.filter((t) => t.net > 0).sort((a, b) => b.net - a.net).slice(0, 3);
  const bearish = snap.teams.filter((t) => t.net < 0).sort((a, b) => a.net - b.net).slice(0, 2);
  const maxNet = Math.max(...snap.teams.map((t) => Math.abs(t.net)), 1);

  return (
    <div className="mt-4 rounded-2xl overflow-hidden border border-violet-500/25 bg-linear-to-br from-violet-950/60 via-violet-900/20 to-transparent">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-violet-500/10 border-b border-violet-500/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-base">📡</div>
          <div>
            <div className="text-sm font-semibold text-violet-200">多源舆情分析</div>
            <div className="text-[10px] text-violet-400/70">小红书 · 微博 · 知乎平台采集</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-mono">
            {snap.total} 条数据
          </span>
          <a href="/data" className="text-[10px] px-2 py-1 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
            查看详情 →
          </a>
        </div>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* 利好 / 利空 两栏 */}
        <div className="grid grid-cols-2 gap-3">
          {/* 利好榜 */}
          <div className="rounded-xl bg-pitch-bright/5 border border-pitch-bright/15 p-3">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs">📈</span>
              <span className="text-[11px] font-semibold text-pitch-bright">舆情利好</span>
            </div>
            {bullish.length === 0 ? (
              <div className="text-[10px] text-muted/50">暂无数据</div>
            ) : (
              <div className="space-y-2">
                {bullish.map((t, i) => (
                  <div key={t.teamId} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-foreground/80 flex items-center gap-1">
                        <span className="text-[9px] w-3.5 h-3.5 rounded-full bg-pitch-bright/20 text-pitch-bright flex items-center justify-center font-bold">{i + 1}</span>
                        {t.teamId}
                      </span>
                      <span className="text-[11px] font-mono text-pitch-bright font-semibold">+{t.net}</span>
                    </div>
                    <div className="h-1 rounded-full bg-surface-2/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-pitch-bright/60"
                        style={{ width: `${Math.round((t.net / maxNet) * 100)}%` }}
                      />
                    </div>
                    {t.topSnippet && (
                      <div className="text-[9px] text-muted/60 leading-tight truncate">"{t.topSnippet}"</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 利空榜 */}
          <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs">📉</span>
              <span className="text-[11px] font-semibold text-red-400">舆情利空</span>
            </div>
            {bearish.length === 0 ? (
              <div className="text-[10px] text-muted/50">暂无数据</div>
            ) : (
              <div className="space-y-2">
                {bearish.map((t, i) => (
                  <div key={t.teamId} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-foreground/80 flex items-center gap-1">
                        <span className="text-[9px] w-3.5 h-3.5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold">{i + 1}</span>
                        {t.teamId}
                      </span>
                      <span className="text-[11px] font-mono text-red-400 font-semibold">{t.net}</span>
                    </div>
                    <div className="h-1 rounded-full bg-surface-2/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-400/50"
                        style={{ width: `${Math.round((Math.abs(t.net) / maxNet) * 100)}%` }}
                      />
                    </div>
                    {t.topSnippet && (
                      <div className="text-[9px] text-muted/60 leading-tight truncate">"{t.topSnippet}"</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 全量球队声量条 */}
        <div>
          <div className="text-[10px] text-muted/60 mb-2 uppercase tracking-wider">声量分布 · Top {snap.teams.length} 队</div>
          <div className="space-y-1.5">
            {snap.teams.slice(0, 6).map((t) => {
              const total = t.pos + t.neg + t.neu || 1;
              const posW = Math.round((t.pos / total) * 100);
              const negW = Math.round((t.neg / total) * 100);
              const neuW = 100 - posW - negW;
              return (
                <div key={t.teamId} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted/70 w-14 truncate shrink-0">{t.teamId}</span>
                  <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-surface-2/40 gap-px">
                    <div className="bg-pitch-bright/55 transition-all" style={{ width: `${posW}%` }} />
                    <div className="bg-surface-2/80" style={{ width: `${neuW}%` }} />
                    <div className="bg-red-400/50 transition-all" style={{ width: `${negW}%` }} />
                  </div>
                  <div className="flex gap-1.5 text-[9px] font-mono shrink-0 w-20 justify-end">
                    <span className="text-pitch-bright/80">+{t.pos}</span>
                    <span className="text-muted/40">/</span>
                    <span className="text-red-400/70">-{t.neg}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 全局舆情备注 */}
        {snap.generalNotes.length > 0 && (
          <div className="rounded-lg bg-surface-2/30 border border-border/30 px-3 py-2">
            <div className="text-[9px] text-muted/50 uppercase tracking-wider mb-1">全局观点</div>
            <div className="text-[10px] text-muted/70 leading-relaxed">
              {snap.generalNotes.slice(0, 2).join("；")}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[9px] text-muted/40">
          <span>📊 舆情声量已作为修正系数融入本次模拟计算</span>
          <span className="flex gap-2">
            <span className="flex items-center gap-0.5"><span className="w-2 h-1 rounded-sm bg-pitch-bright/50 inline-block"/>利好</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-1 rounded-sm bg-red-400/50 inline-block"/>利空</span>
          </span>
        </div>
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

const EXPLORE_MODULES = [
  {
    href: "/bracket",
    icon: "🏆",
    title: "赛程对阵图",
    desc: "完整赛程树 · 每场比分 · 真实与预测对比",
    color: "border-amber-500/25 hover:border-amber-500/50 hover:bg-amber-500/5",
    tag: "可视化",
  },
  {
    href: "/predict",
    icon: "📊",
    title: "各阶段晋级预测",
    desc: "48 队从小组赛到决赛的概率分布热力图",
    color: "border-pitch/25 hover:border-pitch/50 hover:bg-pitch/5",
    tag: "概率",
  },
  {
    href: "/matchup",
    icon: "⚔️",
    title: "对抗设计",
    desc: "任意两队交锋 · 泊松比分预测 · 战术克制分析",
    color: "border-warn/25 hover:border-warn/50 hover:bg-warn/5",
    tag: "对比",
  },
  {
    href: "/relationships",
    icon: "🕸",
    title: "图关系网络",
    desc: "实力 / 攻防 / 风格 / 历史多维度关系图谱",
    color: "border-data/25 hover:border-data/50 hover:bg-data/5",
    tag: "图谱",
  },
  {
    href: "/mood",
    icon: "🧠",
    title: "球员心情分析",
    desc: "情绪建模对球队战力的正负影响量化",
    color: "border-violet/25 hover:border-violet/50 hover:bg-violet/5",
    tag: "心理",
  },
  {
    href: "/data",
    icon: "📡",
    title: "舆情数据中心",
    desc: "多源舆情采集 · 可信度加权 · 影响预测因子",
    color: "border-muted/20 hover:border-muted/40 hover:bg-surface-2",
    tag: "数据",
  },
];

function ExploreModules() {
  return (
    <div className="mt-4">
      <div className="text-[10px] text-muted uppercase tracking-wider mb-2 px-1">🔍 深入探索</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {EXPLORE_MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className={`rounded-xl border p-3 transition-all duration-200 group ${m.color}`}
          >
            <div className="flex items-start justify-between mb-1.5">
              <span className="text-lg">{m.icon}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-2 text-muted">{m.tag}</span>
            </div>
            <div className="text-xs font-semibold text-foreground group-hover:text-foreground transition-colors">{m.title}</div>
            <div className="text-[10px] text-muted mt-0.5 leading-relaxed">{m.desc}</div>
          </Link>
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

// ─── 进度指示器（首次推演时显示，由 phase 事件驱动） ──
const RUN_STAGES = [
  { key: "think", label: "规划任务",     icon: "💭" },
  { key: "fetch", label: "采集赛程",     icon: "🌐" },
  { key: "sim",   label: "蒙特卡洛模拟", icon: "⚙️" },
  { key: "group", label: "小组赛分析",   icon: "📊" },
  { key: "ko",    label: "淘汰赛推演",   icon: "⚔️" },
  { key: "ai",    label: "AI 深度分析",  icon: "🤖" },
];
const PHASE_ORDER = RUN_STAGES.map((s) => s.key);

function RunProgress({ currentPhase }: { currentPhase: string }) {
  const activeIdx = PHASE_ORDER.indexOf(currentPhase);
  return (
    <div className="flex items-center gap-1 flex-wrap mb-3">
      {RUN_STAGES.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all duration-500 ${
              done   ? "bg-pitch/20 text-pitch-bright border border-pitch/20"
              : active ? "bg-data/20 text-data-bright border border-data/30 shadow-[0_0_8px_rgba(14,165,233,0.3)]"
              : "bg-surface-2 text-muted/40 border border-transparent"
            }`}>
              <span className={active ? "animate-spin-slow" : ""}>{s.icon}</span>
              <span>{s.label}</span>
              {done && <span className="text-pitch-bright">✓</span>}
            </div>
            {i < RUN_STAGES.length - 1 && (
              <span className={`text-[10px] transition-colors duration-500 ${done ? "text-pitch/60" : "text-border"}`}>›</span>
            )}
          </div>
        );
      })}
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const queueRef = useRef<{ content: string; id: string }[]>([]);
  const loadingRef = useRef(false);
  const currentTaskIdRef = useRef<string | null>(null);
  let _taskCounter = 0;
  const nextId = () => `ag-${++_taskCounter}`;
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

  /** 标记当前任务完成（短暂显示后移除） */
  const markDone = () => {
    const id = currentTaskIdRef.current;
    if (!id) return;
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "done" } : t));
    setTimeout(() => setTasks((prev) => prev.filter((t) => t.id !== id)), 1000);
    currentTaskIdRef.current = null;
  };

  /** 当前请求完成后取出队列里的下一条文本消息 */
  const drainQueue = () => {
    markDone();
    if (queueRef.current.length === 0) return;
    const [next, ...rest] = queueRef.current;
    queueRef.current = rest;
    // 标记下一条为 running
    currentTaskIdRef.current = next.id;
    setTasks((prev) => prev.map((t) => t.id === next.id ? { ...t, status: "running" } : t));
    _sendMessage(next.content);
  };

  const triggerChat = async (history: AgentChatMessage[], isFirstRun = false) => {
    loadingRef.current = true;
    setLoading(true);
    const placeholder: AgentChatMessage = { role: "assistant", content: "", streaming: true, currentPhase: isFirstRun ? "think" : undefined };
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
      let currentPhase: string | undefined = isFirstRun ? "think" : undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.phase) {
              // 阶段切换事件：更新进度条，不影响文字内容
              currentPhase = json.phase;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], currentPhase };
                return next;
              });
            }
            if (json.delta) {
              fullContent += json.delta;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: fullContent, streaming: true, meta, currentPhase };
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

      // Agent 跑完后把结果写进 store，其他页面（晋级预测、仪表盘、赛程对阵图）直接消费，不再重复模拟
      if (isFirstRun && meta?.topChampions) {
        const top = meta.topChampions as { team: string; probability: number; teamId?: string }[];
        const mcSnapshot: MonteCarloResult = {
          n: 3000,
          topChampions: top.map((c) => ({
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
        // 把 agent 服务端跑的 detailedResult 存入 store，bracket 页面直接复用（数据完全一致）
        if (meta.detailedResult) {
          useAppStore.setState({
            detailedResult: meta.detailedResult as import("@/lib/prediction/detailedSim").DetailedSimResult,
            detailedRunning: false,
            liveContextLoaded: true,
          });
        }
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
      loadingRef.current = false;
      setLoading(false);
      drainQueue();
    }
  };

  /** 实际执行发送（不做 loading 检查，由调用方保证） */
  const _sendMessage = (content: string) => {
    const currentMessages = useAppStore.getState().agentMessages;
    const userMsg: AgentChatMessage = { role: "user", content };
    const newHistory = [...currentMessages, userMsg];
    setMessages(newHistory);
    triggerChat(newHistory, false);
  };

  const sendMessage = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    setInput("");
    const id = nextId();
    if (!loadingRef.current) {
      currentTaskIdRef.current = id;
      setTasks((prev) => [...prev, { id, item: { type: "text", content }, status: "running" }]);
      _sendMessage(content);
    } else {
      queueRef.current = [...queueRef.current, { content, id }];
      setTasks((prev) => [...prev, { id, item: { type: "text", content }, status: "pending" }]);
    }
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
          <div className="text-[10px] text-muted">本页回答：问我任何问题 / 一键生成完整预测报告 · Qwen 驱动</div>
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
            {msg.role === "assistant" && (msg.content || !msg.streaming) && (
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-pitch-bright to-data flex items-center justify-center text-sm shrink-0 mt-1">⚽</div>
            )}

            <div className={`${msg.role === "user" ? "max-w-[72%] order-first" : "max-w-[88%] w-full"}`}>
              {/* 首次推演时显示阶段进度条（由 phase 事件驱动） */}
              {msg.role === "assistant" && msg.streaming && isFirstMsg(idx) && msg.currentPhase && (
                <RunProgress currentPhase={msg.currentPhase} />
              )}

              {/* 消息气泡：内容为空时只显示进度条，不渲染空气泡 */}
              {(msg.content || !msg.streaming) && (() => {
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
                  {msg.meta.sentimentSnapshot && (msg.meta.sentimentSnapshot as SentimentSnapshot).teams.length > 0 && (
                    <SentimentPanel snap={msg.meta.sentimentSnapshot as SentimentSnapshot} />
                  )}
                  {/* 探索更多功能入口 */}
                  <ExploreModules />
                  <div className="flex items-center justify-between px-1 mt-2">
                    <div className="text-[10px] text-muted">
                      {msg.meta.model && `${msg.meta.model} · `}
                      {msg.meta.reportSource === "qwen" ? "Qwen AI 生成" : "本地模板"}
                    </div>
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

      {/* 快捷问题（无任务队列时显示） */}
      {messages.length > 0 && !loading && tasks.length === 0 && (
        <div className="shrink-0 px-4 pb-1 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {QUICK_QUESTIONS.map((q) => (
            <button key={q} onClick={() => sendMessage(q)}
              className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-surface-2 border border-border text-muted hover:text-foreground hover:border-pitch/40 transition-all whitespace-nowrap">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 任务队列 TodoList */}
      {tasks.length > 0 && (
        <div className="shrink-0 px-4 pb-2">
          <TaskQueue tasks={tasks} maxVisible={5} />
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
            rows={1}
            placeholder={loading ? "AI 推演中，输入内容将自动排队…" : "追问任何关于世界杯的问题…"}
            className="flex-1 resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-pitch/60 transition-colors max-h-32"
            style={{ scrollbarWidth: "none" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim()}
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
