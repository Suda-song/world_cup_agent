"use client";

import { useEffect, useState } from "react";
import { TEAMS } from "@/lib/data/teams";
import { apiUrl } from "@/lib/basePath";
import { useAppStore } from "@/lib/store";
import ImpactIntro from "@/components/common/ImpactIntro";
import {
  CATEGORY_LABEL,
  STANCE_LABEL,
  SOURCES,
  type Viewpoint,
  type ViewpointCategory,
  type ViewpointScope,
  type ViewpointStance,
} from "@/lib/viewpoints";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as ViewpointCategory[];
const STANCES = Object.keys(STANCE_LABEL) as ViewpointStance[];

const CAT_COLOR: Record<ViewpointCategory, string> = {
  tactics: "bg-violet/20 text-violet",
  form: "bg-pitch/20 text-pitch-bright",
  history: "bg-gold/20 text-gold",
  opinion: "bg-data/20 text-data-bright",
};
const STANCE_COLOR: Record<ViewpointStance, string> = {
  positive: "text-pitch-bright",
  neutral: "text-muted",
  negative: "text-danger",
};

const SORTED_TEAMS = [...TEAMS].sort((a, b) =>
  a.group === b.group ? a.name.localeCompare(b.name, "zh") : a.group.localeCompare(b.group)
);

export default function SourcesPage() {
  const [viewpoints, setViewpoints] = useState<Viewpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const reloadStoreMods = useAppStore((s) => s.loadViewpoints);

  // form state
  const [scope, setScope] = useState<ViewpointScope>("team");
  const [teamId, setTeamId] = useState<string>(SORTED_TEAMS[0]?.id ?? "");
  const [category, setCategory] = useState<ViewpointCategory>("tactics");
  const [stance, setStance] = useState<ViewpointStance>("positive");
  const [weight, setWeight] = useState(3);
  const [content, setContent] = useState("");
  const [source, setSource] = useState<string>("其他");
  const [link, setLink] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState<{ stance: string; category: string; source: string } | null>(null);

  // 舆情分析：调用 /api/sentiment 对观点文字分类，自动回填倾向/类别。
  const analyze = async () => {
    if (!content.trim()) {
      setError("先填观点内容再做舆情分析");
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/sentiment"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      const d = await res.json();
      if (d.stance) setStance(d.stance);
      if (d.category) setCategory(d.category);
      setAnalyzed({ stance: d.stance, category: d.category, source: d.source });
    } catch {
      setError("舆情分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/viewpoints"), { cache: "no-store" });
      const data = (await res.json()) as { viewpoints?: Viewpoint[] };
      setViewpoints(data.viewpoints ?? []);
    } catch {
      setViewpoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!content.trim()) {
      setError("请输入观点内容");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/viewpoints"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, teamId: scope === "team" ? teamId : null, category, stance, weight, content, source, link }),
      });
      const data = await res.json();
      if (!data.saved) {
        setError(data.reason === "db-not-configured" ? "数据库未配置，无法保存" : data.error || "保存失败");
      } else {
        setContent("");
        setLink("");
        setAnalyzed(null);
        await load();
        reloadStoreMods(); // 让模拟立即用上新观点
      }
    } catch {
      setError("网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    await fetch(apiUrl(`/api/viewpoints?id=${id}`), { method: "DELETE" });
    await load();
    reloadStoreMods();
  };

  const teamName = (id: string | null) => TEAMS.find((t) => t.id === id)?.name ?? id ?? "—";
  const teamFlag = (id: string | null) => TEAMS.find((t) => t.id === id)?.flag ?? "🏳️";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <ImpactIntro
        title="多源舆情采集"
        subtitle="从小红书 / 微博 / 抖音等平台采集对球队的观点，作为预测的额外数据源。录入的每条观点都会实时参与冠军预测计算。"
        steps={[
          { icon: "📥", label: "① 采集观点", desc: "选平台/球队/倾向/权重录入" },
          { icon: "⚖️", label: "② 加权折算", desc: "按类别·倾向·可信度计算" },
          { icon: "🎲", label: "③ 注入模拟", desc: "修正球队战力进蒙特卡洛" },
          { icon: "🏆", label: "④ 改变预测", desc: "夺冠概率与比分随之变化" },
        ]}
        resultLink={{ href: "/", label: "总览" }}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── 录入表单 ─────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">添加观点</h2>

          {/* scope */}
          <div className="flex gap-2">
            {(["team", "general"] as ViewpointScope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                  scope === s ? "bg-pitch/20 text-pitch-bright glow-pitch" : "bg-surface-2 text-muted hover:text-foreground"
                }`}
              >
                {s === "team" ? "针对球队" : "全局 / 泛观点"}
              </button>
            ))}
          </div>

          {/* team select */}
          {scope === "team" && (
            <div>
              <label className="text-xs text-muted">球队</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full mt-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm"
              >
                {SORTED_TEAMS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.flag} {t.name}（{t.group}组）
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* category */}
          <div>
            <label className="text-xs text-muted">类别</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`py-2 rounded-xl text-sm transition-all ${
                    category === c ? CAT_COLOR[c] : "bg-surface-2 text-muted hover:text-foreground"
                  }`}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {/* source platform */}
          <div>
            <label className="text-xs text-muted">来源平台</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {SOURCES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`px-3 py-1.5 rounded-xl text-sm transition-all ${
                    source === s ? "bg-data/20 text-data-bright ring-1 ring-data/40" : "bg-surface-2 text-muted hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* stance */}
          <div>
            <label className="text-xs text-muted">倾向</label>
            <div className="flex gap-2 mt-1">
              {STANCES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStance(s)}
                  className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                    stance === s ? "bg-surface-2 ring-1 ring-border " + STANCE_COLOR[s] : "bg-surface-2 text-muted hover:text-foreground"
                  }`}
                >
                  {STANCE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* weight */}
          <div>
            <label className="text-xs text-muted">权重（影响强度）：{weight}</label>
            <input
              type="range"
              min={1}
              max={5}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full mt-1 accent-pitch-bright"
            />
          </div>

          {/* content + 舆情分析 */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted">观点内容</label>
              <button
                type="button"
                onClick={analyze}
                disabled={analyzing}
                className="text-[11px] px-2 py-0.5 rounded-lg bg-gradient-to-r from-purple-500/30 to-indigo-500/30 border border-purple-500/30 text-purple-300 hover:brightness-110 disabled:opacity-50"
              >
                {analyzing ? "分析中…" : "🔎 舆情分析(自动判倾向/类别)"}
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="粘贴小红书/微博笔记文字，例如：梅西状态火热，锋线串联流畅，看好阿根廷卫冕"
              className="w-full mt-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm resize-none"
            />
            {analyzed && (
              <div className="mt-1 text-[11px] text-muted">
                舆情分析（{analyzed.source === "qwen" ? "Qwen" : "本地"}）：倾向
                <span className="text-pitch-bright"> {STANCE_LABEL[analyzed.stance as ViewpointStance] ?? analyzed.stance}</span>
                · 类别 <span className="text-data-bright">{CATEGORY_LABEL[analyzed.category as ViewpointCategory] ?? analyzed.category}</span>
                （已自动填好，可手动改）
              </div>
            )}
          </div>

          {/* link */}
          <div>
            <label className="text-xs text-muted">来源链接（可选，如小红书笔记 URL）</label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.xiaohongshu.com/..."
              className="w-full mt-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm"
            />
          </div>

          {error && <div className="text-xs text-danger">{error}</div>}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pitch to-data-bright text-white font-medium text-sm disabled:opacity-50"
          >
            {submitting ? "提交中…" : "提交观点"}
          </button>
        </div>

        {/* ── 已采集观点列表 ─────────────────────────── */}
        <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">已采集观点</h2>
          <span className="text-xs text-muted">{viewpoints.length} 条</span>
        </div>
        {loading ? (
          <div className="text-sm text-muted py-8 text-center">加载中…</div>
        ) : viewpoints.length === 0 ? (
          <div className="text-sm text-muted py-8 text-center">还没有观点，先在左侧添加一条。</div>
        ) : (
          <div className="space-y-2">
            {viewpoints.map((v) => {
              const isXHS = v.link && v.link.includes("xiaohongshu");
              return isXHS ? (
                // ── 小红书卡片 ────────────────────────────
                <div key={v.id} className="rounded-2xl border border-[#ff2442]/30 bg-[#ff2442]/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* 小红书图标 */}
                      <div className="shrink-0 w-8 h-8 rounded-xl bg-[#ff2442] flex items-center justify-center text-white font-bold text-sm select-none">
                        书
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-[#ff6680]">📕 小红书笔记</div>
                        <div className="text-[10px] text-muted flex items-center gap-1.5 flex-wrap">
                          <span>{v.scope === "general" ? "🌐 全局" : `${teamFlag(v.teamId)} ${teamName(v.teamId)}`}</span>
                          <span className={`${STANCE_COLOR[v.stance]}`}>{STANCE_LABEL[v.stance]}</span>
                          <span className={`px-1 py-0.5 rounded text-[9px] ${CAT_COLOR[v.category]}`}>{CATEGORY_LABEL[v.category]}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={v.link!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-[#ff2442]/20 text-[#ff6680] hover:bg-[#ff2442]/30"
                      >
                        打开
                      </a>
                      <button onClick={() => remove(v.id)} className="text-muted hover:text-danger text-xs" aria-label="删除">✕</button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/85 mt-2 break-words">{v.content}</p>
                </div>
              ) : (
                // ── 普通卡片 ─────────────────────────────
                <div key={v.id} className="card-2 p-3 flex items-start gap-3">
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${CAT_COLOR[v.category]}`}>
                      {CATEGORY_LABEL[v.category]}
                    </span>
                    <span className={`text-[10px] ${STANCE_COLOR[v.stance]}`}>
                      {STANCE_LABEL[v.stance]} · 权重{v.weight}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted mb-0.5 flex items-center gap-2 flex-wrap">
                      <span>{v.scope === "general" ? "🌐 全局" : `${teamFlag(v.teamId)} ${teamName(v.teamId)}`}</span>
                      {v.source && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-data/15 text-data-bright">
                          {v.source}
                        </span>
                      )}
                      {v.link && (
                        <a href={v.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-data-bright hover:underline">🔗 原帖</a>
                      )}
                    </div>
                    <p className="text-sm text-foreground/90 break-words">{v.content}</p>
                  </div>
                  <button
                    onClick={() => remove(v.id)}
                    className="shrink-0 text-muted hover:text-danger text-xs"
                    aria-label="删除"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
