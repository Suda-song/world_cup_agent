"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import { useAppStore, type AgentChatMessage } from "@/lib/store";

const QUICK_TASKS = ["为什么这支队最有可能夺冠？", "本届最大黑马是谁？", "决赛预测是什么？"];

export default function FloatingAgent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // 与 /agent 页面共享同一份消息状态
  const messages = useAppStore((s) => s.agentMessages);
  const setMessages = useAppStore((s) => s.setAgentMessages);
  const agentInitialized = useAppStore((s) => s.agentInitialized);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [open, messages]);

  // 在 /agent 或首页（/）不显示悬浮球
  if (pathname === "/agent" || pathname === "/") return null;

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");
    setOpen(true);

    const userMsg: AgentChatMessage = { role: "user", content };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);

    setLoading(true);
    const placeholder: AgentChatMessage = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, placeholder]);

    try {
      const res = await fetch(apiUrl("/api/agent/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 不是首次运行，带上对话历史
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
        const lines = decoder.decode(value).split("\n");
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
      setLoading(false);
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
                  <div
                    className={`inline-block max-w-[92%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                      msg.role === "user"
                        ? "bg-pitch/20 border border-pitch/30 text-foreground"
                        : "bg-surface-2 text-foreground"
                    }`}
                  >
                    {msg.content}
                    {msg.streaming && (
                      <span className="inline-block w-0.5 h-3 bg-pitch-bright ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                  {/* 显示首条回复的夺冠 Top3 */}
                  {msg.role === "assistant" && !msg.streaming && msg.meta?.topChampions && (
                    <div className="mt-1.5 inline-block max-w-[92%] rounded-xl border border-border bg-surface/60 px-3 py-2 text-left">
                      <div className="text-[10px] text-muted mb-1">夺冠概率 Top 3</div>
                      {(msg.meta.topChampions as { team: string; probability: number }[]).slice(0, 3).map((c, i) => (
                        <div key={c.team} className="flex justify-between gap-3 text-[11px]">
                          <span className="text-muted">{i + 1}. {c.team}</span>
                          <span className="font-mono text-pitch-bright">{(c.probability * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="rounded-2xl bg-surface-2 px-3 py-2 text-xs text-muted">
                推演中…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 快捷 + 输入 */}
          <div className="border-t border-border px-4 py-3 shrink-0">
            {!isEmpty && (
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
                disabled={loading || !agentInitialized}
                placeholder={agentInitialized ? "追问任何世界杯问题…" : "请先前往 Agent 页面运行预测"}
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-pitch disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || !agentInitialized}
                className="rounded-xl bg-pitch-bright px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
              >
                发送
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
