"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "总览仪表盘", icon: "M3 12l9-9 9 9M5 10v10h14V10", desc: "夺冠概率与关键指标" },
  { href: "/bracket", label: "赛程对阵", icon: "M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16", desc: "完整赛果预测与推理链路" },
  { href: "/predict", label: "晋级预测", icon: "M4 18V8l8-5 8 5v10M9 18v-6h6v6", desc: "蒙特卡洛各阶段模拟" },
  { href: "/relationships", label: "图关系", icon: "M12 2a10 10 0 100 20 10 10 0 000-20M2 12h20M12 2a15 15 0 010 20", desc: "多维度球队关系网络" },
  { href: "/matchup", label: "对抗设计", icon: "M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5", desc: "两两对战与战术克制" },
  { href: "/mood", label: "心情分析", icon: "M9 11l3 3 8-8M21 12a9 9 0 11-6-8.5", desc: "球员情绪建模与演化" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-surface/60 backdrop-blur-xl flex flex-col h-screen sticky top-0">
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

      <div className="p-4 border-t border-border text-[10px] text-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-pitch-bright animate-pulse-soft" />
          引擎在线 · Elo+泊松+蒙特卡洛+Qwen
        </div>
      </div>
    </aside>
  );
}
