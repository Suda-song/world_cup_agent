"use client";

import { useEffect, useMemo, useState } from "react";
import { TEAMS } from "@/lib/data/teams";
import { apiUrl } from "@/lib/basePath";
import { useAppStore } from "@/lib/store";
import ImpactIntro from "@/components/common/ImpactIntro";
import { CATEGORY_LABEL, STANCE_LABEL, type Viewpoint } from "@/lib/viewpoints";

interface SourceCfgRow {
  source: string;
  weight: number;
  enabled: boolean;
}

interface Prediction {
  id: number;
  champion_name: string;
  probability: number;
  runner_up_name: string | null;
  sim_count: number;
  use_mood: number;
  created_at: string;
}

const teamName = (id: string | null) =>
  TEAMS.find((t) => t.id === id)?.name ?? id ?? "—";

function tally<T extends string>(items: T[]): [T, number][] {
  const m = new Map<T, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataPage() {
  const [viewpoints, setViewpoints] = useState<Viewpoint[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [srcCfg, setSrcCfg] = useState<SourceCfgRow[]>([]);
  const [saving, setSaving] = useState<string>(""); // source being saved
  const [loading, setLoading] = useState(true);
  const reloadMods = useAppStore((s) => s.loadViewpoints);
  const viewpointMods = useAppStore((s) => s.viewpointMods);

  // Same per-team modifier the Monte Carlo uses — reflects viewpoints × source weights.
  const impact = useMemo(
    () =>
      TEAMS.map((t) => ({ team: t, mod: viewpointMods[t.id] ?? 1 }))
        .filter((x) => Math.abs(x.mod - 1) > 0.0001)
        .sort((a, b) => b.mod - a.mod),
    [viewpointMods],
  );

  useEffect(() => {
    (async () => {
      try {
        const [vp, pr, cfg] = await Promise.all([
          fetch(apiUrl("/api/viewpoints"), { cache: "no-store" }).then((r) =>
            r.json(),
          ),
          fetch(apiUrl("/api/predictions"), { cache: "no-store" }).then((r) =>
            r.json(),
          ),
          fetch(apiUrl("/api/source-config"), { cache: "no-store" }).then((r) =>
            r.json(),
          ),
        ]);
        setViewpoints(vp.viewpoints ?? []);
        setPredictions(pr.recent ?? []);
        setSrcCfg(
          (cfg.config ?? []).map(
            (c: { source: string; weight: unknown; enabled: unknown }) => ({
              source: c.source as string,
              weight: Number(c.weight),
              enabled: Number(c.enabled) === 1,
            }),
          ),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveSrcCfg = async (row: SourceCfgRow) => {
    setSaving(row.source);
    await fetch(apiUrl("/api/source-config"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: row.source,
        weight: row.weight,
        enabled: row.enabled,
      }),
    });
    setSaving("");
    // Propagate to simulation immediately.
    reloadMods();
  };

  const bySource = useMemo(
    () => tally(viewpoints.map((v) => v.source || "其他")),
    [viewpoints],
  );
  const byCategory = useMemo(
    () => tally(viewpoints.map((v) => CATEGORY_LABEL[v.category])),
    [viewpoints],
  );
  const byStance = useMemo(
    () => tally(viewpoints.map((v) => STANCE_LABEL[v.stance])),
    [viewpoints],
  );
  const byTeam = useMemo(
    () =>
      tally(
        viewpoints
          .filter((v) => v.scope === "team")
          .map((v) => teamName(v.teamId)),
      ).slice(0, 10),
    [viewpoints],
  );

  const exportViewpoints = () =>
    download(
      "viewpoints.csv",
      toCsv(
        viewpoints.map((v) => ({
          id: v.id,
          source: v.source || "其他",
          scope: v.scope,
          team: v.scope === "team" ? teamName(v.teamId) : "全局",
          team_id: v.teamId ?? "",
          category: CATEGORY_LABEL[v.category],
          stance: STANCE_LABEL[v.stance],
          weight: v.weight,
          content: v.content,
          created_at: v.createdAt ?? "",
        })),
      ),
    );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <ImpactIntro
        title="舆情数据中心"
        subtitle="多源观点采集后如何加权、如何影响冠军预测 —— 数据源 → 可信度 → 战力修正 → 预测，全链路可解释。调节下方各平台可信度权重会直接改变预测结果。"
        steps={[
          { label: "汇总观点", desc: "全平台观点数据总览" },
          { label: "可信度加权", desc: "调平台权重(0-3)/开关" },
          { label: "战力修正", desc: "实时算出各队修正系数" },
          { label: "影响预测", desc: "冠军概率随之变化" },
        ]}
        resultLink={{ href: "/predict", label: "晋级预测" }}
      />
      <div className="flex justify-end">
        <button
          onClick={exportViewpoints}
          className="px-4 py-2 rounded-xl bg-surface-2 border border-border text-sm hover:text-pitch-bright"
        >
          ⬇ 导出观点 CSV
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted py-16 text-center">加载中…</div>
      ) : (
        <>
          {/* ── 数据源可信度（直接影响预测）──── */}
          <div className="card p-5 border-data/30">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold">数据源可信度 · 影响预测</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-data/20 text-data-bright">
                可解释调节
              </span>
            </div>
            <p className="text-xs text-muted mb-4">
              为每个平台设置可信度权重（0–3，关闭则该平台观点不参与预测）——
              体现"数据源不同可信度"的可解释建模。保存即时生效，下次模拟按新权重计算。
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {srcCfg.map((row, i) => (
                <div
                  key={row.source}
                  className={`card-2 p-3 ${row.enabled ? "" : "opacity-50"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{row.source}</span>
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => {
                          const next = [...srcCfg];
                          next[i] = { ...row, enabled: e.target.checked };
                          setSrcCfg(next);
                          saveSrcCfg(next[i]);
                        }}
                        className="accent-pitch-bright w-3.5 h-3.5"
                      />
                      启用
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={row.weight}
                      disabled={!row.enabled}
                      onChange={(e) => {
                        const next = [...srcCfg];
                        next[i] = { ...row, weight: Number(e.target.value) };
                        setSrcCfg(next);
                      }}
                      onMouseUp={() => saveSrcCfg(srcCfg[i])}
                      onTouchEnd={() => saveSrcCfg(srcCfg[i])}
                      className="flex-1 accent-data-bright"
                    />
                    <span className="w-12 text-right font-mono text-sm text-data-bright">
                      ×{row.weight.toFixed(1)}
                    </span>
                  </div>
                  {saving === row.source && (
                    <div className="text-[10px] text-muted mt-1">保存中…</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── 对冠军预测的影响 ─────────────────── */}
          <div className="card p-5">
            <h2 className="font-semibold mb-1">对冠军预测的影响</h2>
            <p className="text-xs text-muted mb-3">
              各队战力修正系数（&gt;1 利好，&lt;1 利空）= 观点 ×
              数据源可信度加权后的结果，已实时用于蒙特卡洛模拟。
            </p>
            {impact.length === 0 ? (
              <div className="text-sm text-muted py-6 text-center">
                暂无生效的观点（去「多源舆情采集」录入）
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {impact.map(({ team, mod }) => {
                  const pct = (mod - 1) * 100;
                  const up = pct >= 0;
                  return (
                    <div
                      key={team.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="w-24 shrink-0 truncate">
                        {team.flag} {team.name}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-surface-2 relative overflow-hidden">
                        <div
                          className={`absolute top-0 bottom-0 ${up ? "left-1/2 bg-pitch-bright" : "right-1/2 bg-danger"}`}
                          style={{
                            width: `${Math.min(50, Math.abs(pct) * 3)}%`,
                          }}
                        />
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
                      </div>
                      <span
                        className={`w-14 text-right font-mono text-xs ${up ? "text-pitch-bright" : "text-danger"}`}
                      >
                        {up ? "+" : ""}
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 统计卡片 ─────────────────────────── */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="总观点数"
              big={String(viewpoints.length)}
              rows={bySource}
              unit="条"
            />
            <StatCard title="按倾向" rows={byStance} unit="条" />
            <StatCard title="按类别" rows={byCategory} unit="条" />
            <StatCard
              title="预测记录"
              big={String(predictions.length)}
              rows={[["最近100条", predictions.length]]}
              unit=""
            />
          </div>

          {/* ── 来源平台 + 球队 ──────────────────── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h2 className="font-semibold mb-3">来源平台分布</h2>
              <BarList rows={bySource} total={viewpoints.length} />
            </div>
            <div className="card p-5">
              <h2 className="font-semibold mb-3">观点最多的球队 Top 10</h2>
              {byTeam.length === 0 ? (
                <div className="text-sm text-muted py-6 text-center">
                  暂无球队观点
                </div>
              ) : (
                <BarList rows={byTeam} total={byTeam[0]?.[1] ?? 1} />
              )}
            </div>
          </div>

          {/* ── 全量观点表 ───────────────────────── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                全量观点数据（{viewpoints.length}）
              </h2>
            </div>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs min-w-[860px]">
                <thead>
                  <tr className="text-muted border-b border-border">
                    {[
                      "ID",
                      "来源",
                      "范围",
                      "球队",
                      "类别",
                      "倾向",
                      "权重",
                      "内容",
                      "时间",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left font-medium px-2 py-2 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewpoints.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-border/50 hover:bg-surface-2/50"
                    >
                      <td className="px-2 py-2 font-mono text-muted">{v.id}</td>
                      <td className="px-2 py-2">
                        <span className="px-1.5 py-0.5 rounded bg-data/15 text-data-bright">
                          {v.source || "其他"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {v.scope === "general" ? "全局" : "球队"}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {v.scope === "team" ? teamName(v.teamId) : "—"}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {CATEGORY_LABEL[v.category]}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {STANCE_LABEL[v.stance]}
                      </td>
                      <td className="px-2 py-2 font-mono">{v.weight}</td>
                      <td
                        className="px-2 py-2 max-w-[280px] truncate"
                        title={v.content}
                      >
                        {v.content}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-muted">
                        {(v.createdAt || "").replace("T", " ").slice(0, 16)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewpoints.length === 0 && (
                <div className="text-sm text-muted py-8 text-center">
                  暂无观点数据
                </div>
              )}
            </div>
          </div>

          {/* ── 预测记录表 ───────────────────────── */}
          <div className="card p-5">
            <h2 className="font-semibold mb-3">
              预测记录（最近 {predictions.length}）
            </h2>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="text-muted border-b border-border">
                    {[
                      "ID",
                      "冠军",
                      "夺冠概率",
                      "亚军",
                      "模拟次数",
                      "心情",
                      "时间",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left font-medium px-2 py-2 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/50 hover:bg-surface-2/50"
                    >
                      <td className="px-2 py-2 font-mono text-muted">{p.id}</td>
                      <td className="px-2 py-2">{p.champion_name}</td>
                      <td className="px-2 py-2 font-mono text-pitch-bright">
                        {Number(p.probability).toFixed(1)}%
                      </td>
                      <td className="px-2 py-2">{p.runner_up_name ?? "—"}</td>
                      <td className="px-2 py-2 font-mono">{p.sim_count}</td>
                      <td className="px-2 py-2">{p.use_mood ? "✓" : "—"}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-muted">
                        {(p.created_at || "").replace("T", " ").slice(0, 16)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {predictions.length === 0 && (
                <div className="text-sm text-muted py-8 text-center">
                  暂无预测记录
                </div>
              )}
            </div>
          </div>

          {/* ── 小红书运动薯直播 ──── */}
          <div id="xhs-live" className="scroll-mt-20">
            <XhsLiveCard />
          </div>
        </>
      )}
    </div>
  );
}

const XHS_LIVE_URL =
  "https://www.xiaohongshu.com/livestream/570347737968922116?source=web_search_onebox&xsec_token=ABCu7j15KJ8R3qzeGm2ZiWPCbqcBuCRuDZppTO2w-1aOeHPSsVYyso5UofX6qja-re&keyword=%E8%BF%90%E5%8A%A8%E8%96%AF";

const XHS_MOCK_ANALYSIS = [
  {
    tag: "热度峰值",
    icon: "🔥",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    title: "法国 vs 阿根廷 成最高话题",
    desc: "本场话题量破 280 万，评论区法阿球迷激烈交锋，#决赛预测# 话题阅读量 24 小时涨幅 +340%。",
  },
  {
    tag: "正向情绪",
    icon: "📈",
    color: "text-pitch-bright",
    bg: "bg-pitch-bright/10 border-pitch-bright/20",
    title: "阿根廷舆情持续升温",
    desc: "梅西相关词条连续 3 天登顶运动热榜，球迷弹幕以「传奇」「封神」为主，情绪指数 +4.2。",
  },
  {
    tag: "负向预警",
    icon: "⚠️",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    title: "英格兰出局引发大规模吐槽",
    desc: '英格兰淘汰后涌入大量负面评论，"又输了" "失望" 等词云密度激增，情绪指数 -2.8。',
  },
  {
    tag: "黑马声量",
    icon: "🌟",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    title: "摩洛哥意外破圈",
    desc: "摩洛哥每场胜利后均引发一波「非洲雄狮崛起」讨论，跨文化共鸣显著，转发量高于预期 220%。",
  },
  {
    tag: "情绪预测",
    icon: "🤖",
    color: "text-data-bright",
    bg: "bg-data/10 border-data/20",
    title: "AI 判断：决赛情绪将创历届峰值",
    desc: "基于现有声量增速曲线，模型预测决赛日直播间弹幕密度将达 12,000 条/分钟，超越 2022 年卡塔尔决赛。",
  },
];

function XhsLiveCard() {
  return (
    <div className="card p-0 overflow-hidden border-rose-500/20">
      {/* 头部 */}
      <div className="flex items-center justify-between px-5 py-3 bg-linear-to-r from-rose-500/10 to-transparent border-b border-rose-500/15">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-lg">
            📱
          </div>
          <div>
            <div className="text-sm font-semibold text-rose-200">
              小红书 · 运动薯直播 × AI 舆情解读
            </div>
            <div className="text-[10px] text-rose-400/60">
              实时直播回放 · 多维情绪指数分析
            </div>
          </div>
        </div>
        <a
          href={XHS_LIVE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/25 text-xs text-rose-300 hover:bg-rose-500/25 transition-colors"
        >
          <span>前往直播页</span>
          <span>↗</span>
        </a>
      </div>

      {/* 主体：左视频 + 右分析 */}
      <div className="flex flex-col lg:flex-row">
        {/* 左侧：视频（固定宽度） */}
        <div className="lg:w-[52%] shrink-0 relative bg-black">
          <div className="relative" style={{ paddingBottom: "56.25%" }}>
            <video
              className="absolute inset-0 w-full h-full object-contain"
              controls
              autoPlay={false}
              loop={false}
              playsInline
              preload="metadata"
            >
              <source src={apiUrl("/videos/xhs-live-demo.mp4")} type="video/mp4" />
              您的浏览器不支持视频播放
            </video>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-rose-500/80 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] font-semibold text-white tracking-wide">
                直播回放
              </span>
            </div>
          </div>
        </div>

        {/* 右侧：AI 舆情分析 */}
        <div className="flex-1 border-t lg:border-t-0 lg:border-l border-border/20 flex flex-col">
          {/* 右侧标题 */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/20 bg-surface-2/20">
            <span className="text-xs font-semibold text-foreground/80">
              🤖 AI 舆情解读
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-data/15 text-data-bright">
              模拟数据
            </span>
          </div>

          {/* 分析条目列表 */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/15">
            {XHS_MOCK_ANALYSIS.map((item) => (
              <div
                key={item.tag}
                className="px-4 py-3 hover:bg-surface-2/20 transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${item.bg} ${item.color}`}
                  >
                    {item.icon} {item.tag}
                  </span>
                </div>
                <div className="text-[12px] font-medium text-foreground/90 mb-0.5">
                  {item.title}
                </div>
                <div className="text-[11px] text-muted/70 leading-relaxed">
                  {item.desc}
                </div>
              </div>
            ))}
          </div>

          {/* 右侧底部 */}
          <div className="px-4 py-2 border-t border-border/15 bg-surface-2/10">
            <div className="text-[9px] text-muted/40">
              📊 数据来源： 平台实时采集 · 情绪指数为模型估算值
            </div>
          </div>
        </div>
      </div>

      {/* 底部说明 */}
      <div className="px-5 py-2 bg-surface-2/20 border-t border-border/20 flex items-center justify-between">
        <span className="text-[10px] text-muted/50">
          内容来源： 运动薯 · 世界杯舆情参考
        </span>
        <a
          href={XHS_LIVE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-rose-400/60 hover:text-rose-300 transition-colors"
        >
          查看原始直播 →
        </a>
      </div>
    </div>
  );
}

function StatCard({
  title,
  big,
  rows,
  unit,
}: {
  title: string;
  big?: string;
  rows: [string, number][];
  unit: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{title}</div>
      {big && (
        <div className="text-3xl font-bold mt-1 text-gradient">{big}</div>
      )}
      <div className="mt-2 space-y-1">
        {rows.slice(0, 6).map(([k, n]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className="text-muted truncate">{k}</span>
            <span className="font-mono">
              {n}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarList({ rows, total }: { rows: [string, number][]; total: number }) {
  return (
    <div className="space-y-2">
      {rows.map(([k, n]) => (
        <div key={k} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate text-muted">{k}</span>
          <div className="flex-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-data-bright"
              style={{ width: `${total > 0 ? (n / total) * 100 : 0}%` }}
            />
          </div>
          <span className="w-10 text-right font-mono text-xs">{n}</span>
        </div>
      ))}
    </div>
  );
}
