"use client";

import { getScheduleStatus, currentFocusStage, formatDate } from "@/lib/schedule";

// Horizontal tournament timeline; highlights the current stage based on today's date.
export default function StageTimeline({ compact = false }: { compact?: boolean }) {
  const statuses = getScheduleStatus();
  const focus = currentFocusStage();

  return (
    <div className="card p-4">
      {!compact && (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-sm font-semibold">2026 世界杯赛程</div>
          <div className="text-xs text-muted">
            当前：
            <span className="text-pitch-bright font-medium">
              {focus.stage.labelFull}
            </span>
            （{formatDate(focus.stage.start)}–{formatDate(focus.stage.end)}）
            {focus.status === "next" ? " · 即将开始" : focus.stage.key === "group" ? "" : " · 淘汰赛进行中"}
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {statuses.map(({ stage, status }, i) => (
          <div key={stage.key} className="flex items-center shrink-0">
            <div
              className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-[68px] transition-all ${
                status === "live"
                  ? "bg-pitch/20 text-pitch-bright glow-pitch ring-1 ring-pitch/40"
                  : status === "next"
                  ? "bg-data/15 text-data-bright ring-1 ring-data/30"
                  : status === "done"
                  ? "bg-surface-2 text-muted"
                  : "bg-surface-2/50 text-muted/60"
              }`}
            >
              <span className="text-xs font-medium whitespace-nowrap">
                {status === "done" && "✓ "}{stage.label}
              </span>
              <span className="text-[10px] opacity-70 whitespace-nowrap">
                {formatDate(stage.start)}
                {stage.start !== stage.end ? `–${formatDate(stage.end)}` : ""}
              </span>
            </div>
            {i < statuses.length - 1 && (
              <div className={`w-3 h-px ${status === "done" ? "bg-pitch/40" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
