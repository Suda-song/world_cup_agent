"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";

interface NavItem { href: string; label: string; icon: string; desc: string; tag?: string }

const NAV_SECTIONS: { title: string; hint: string; items: NavItem[] }[] = [
  {
    title: "核心预测",
    hint: "对外展示",
    items: [
      { href: "/", label: "总览仪表盘", icon: "M3 12l9-9 9 9M5 10v10h14V10", desc: "夺冠概率与关键指标" },
      { href: "/bracket", label: "赛程对阵图", icon: "M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16", desc: "赛程树·比分·推理链路" },
      { href: "/predict", label: "晋级预测", icon: "M4 18V8l8-5 8 5v10M9 18v-6h6v6", desc: "蒙特卡洛各阶段概率" },
    ],
  },
  {
    title: "深度分析",
    hint: "辅助洞察",
    items: [
      { href: "/matchup", label: "对抗设计", icon: "M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5", desc: "两两对战与战术克制" },
      { href: "/relationships", label: "图关系", icon: "M12 2a10 10 0 100 20 10 10 0 000-20M2 12h20M12 2a15 15 0 010 20", desc: "多维度球队关系网络" },
      { href: "/mood", label: "心情分析", icon: "M9 11l3 3 8-8M21 12a9 9 0 11-6-8.5", desc: "球员情绪建模与演化" },
    ],
  },
  {
    title: "数据配置与分析",
    hint: "影响预测",
    items: [
      { href: "/sources", label: "多源舆情采集", icon: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3", desc: "采集观点 → 影响预测", tag: "配置" },
      { href: "/data", label: "舆情数据中心", icon: "M3 3v18h18M7 15l3-4 3 2 4-6", desc: "可信度加权 → 影响预测", tag: "分析" },
    ],
  },
];

function NavLinks({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="space-y-1">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/70">{section.title}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 text-muted/60">{section.hint}</span>
          </div>
          {section.items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                  active
                    ? "bg-pitch/15 text-pitch-bright glow-pitch"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 shrink-0"
                >
                  <path d={item.icon} />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {item.label}
                    {item.tag && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-data/20 text-data-bright">{item.tag}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted truncate">{item.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarHeader() {
  return (
    <div className="p-5 border-b border-border">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pitch-bright to-data flex items-center justify-center text-lg">
          ⚽
        </div>
        <div>
          <div className="font-bold text-sm leading-tight">世界杯预测</div>
          <div className="text-[10px] text-muted">2026 美加墨 · 48队</div>
        </div>
      </div>
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="p-4 border-t border-border text-[10px] text-muted">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-pitch-bright animate-pulse-soft" />
        引擎在线 · Elo+泊松+蒙特卡洛+Qwen
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const loadViewpoints = useAppStore((s) => s.loadViewpoints);

  // Load user viewpoints once so they factor into simulations from any entry page.
  useEffect(() => {
    loadViewpoints();
  }, [loadViewpoints]);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ─────────────────────────── */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border bg-surface/60 backdrop-blur-xl flex-col h-screen sticky top-0">
        <SidebarHeader />
        <NavLinks />
        <SidebarFooter />
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-4 border-b border-border bg-surface/90 backdrop-blur-xl">
        <button
          aria-label="打开菜单"
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="ml-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pitch-bright to-data flex items-center justify-center text-sm">⚽</div>
          <span className="font-bold text-sm">世界杯预测</span>
        </div>
      </div>

      {/* ── Mobile drawer backdrop ──────────────────────────────────────── */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ─────────────────────────────────────────── */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col bg-surface border-r border-border transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pitch-bright to-data flex items-center justify-center">⚽</div>
            <div>
              <div className="font-bold text-sm leading-tight">世界杯预测</div>
              <div className="text-[10px] text-muted">2026 美加墨 · 48队</div>
            </div>
          </div>
          <button
            aria-label="关闭菜单"
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <NavLinks onClose={() => setOpen(false)} />
        <SidebarFooter />
      </aside>
    </>
  );
}
