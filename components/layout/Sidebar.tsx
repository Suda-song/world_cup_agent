"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const NAV = [
  { href: "/", label: "总览仪表盘", icon: "M3 12l9-9 9 9M5 10v10h14V10", desc: "夺冠概率与关键指标" },
  { href: "/bracket", label: "赛程对阵", icon: "M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16", desc: "完整赛果预测与推理链路" },
  { href: "/predict", label: "晋级预测", icon: "M4 18V8l8-5 8 5v10M9 18v-6h6v6", desc: "蒙特卡洛各阶段模拟" },
  { href: "/relationships", label: "图关系", icon: "M12 2a10 10 0 100 20 10 10 0 000-20M2 12h20M12 2a15 15 0 010 20", desc: "多维度球队关系网络" },
  { href: "/matchup", label: "对抗设计", icon: "M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5", desc: "两两对战与战术克制" },
  { href: "/mood", label: "心情分析", icon: "M9 11l3 3 8-8M21 12a9 9 0 11-6-8.5", desc: "球员情绪建模与演化" },
];

function NavLinks({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
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
            <div className="min-w-0">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-[10px] text-muted truncate">{item.desc}</div>
            </div>
          </Link>
        );
      })}
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
        引擎在线 · Elo+泊松+蒙特卡洛
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
