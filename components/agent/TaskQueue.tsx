"use client";

import { type MatchCardPayload } from "@/lib/store";
import { getTeam } from "@/lib/data/loader";

export type TaskItem =
  | { type: "text"; content: string }
  | { type: "match"; card: MatchCardPayload };

export type TaskStatus = "running" | "pending" | "done";

export interface Task {
  id: string;
  item: TaskItem;
  status: TaskStatus;
}

function taskLabel(item: TaskItem): string {
  if (item.type === "match") {
    const tA = getTeam(item.card.teamA);
    const tB = getTeam(item.card.teamB);
    return `分析赛事：${tA?.name ?? item.card.teamA} vs ${tB?.name ?? item.card.teamB}`;
  }
  const text = item.content.trim();
  return text.length > 36 ? text.slice(0, 36) + "…" : text;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-pitch/25 text-pitch-bright text-[10px] shrink-0">
        ✓
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <span className="inline-flex gap-[2px]">
          <span className="w-[3px] h-[3px] rounded-full bg-pitch-bright animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-[3px] h-[3px] rounded-full bg-pitch-bright animate-bounce" style={{ animationDelay: "120ms" }} />
          <span className="w-[3px] h-[3px] rounded-full bg-pitch-bright animate-bounce" style={{ animationDelay: "240ms" }} />
        </span>
      </span>
    );
  }
  // pending
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border/60 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 animate-pulse" />
    </span>
  );
}

interface TaskQueueProps {
  tasks: Task[];
  /** 最多展示的任务数（超过折叠），默认 5 */
  maxVisible?: number;
}

export default function TaskQueue({ tasks, maxVisible = 5 }: TaskQueueProps) {
  if (tasks.length === 0) return null;

  const visible = tasks.slice(0, maxVisible);
  const hiddenCount = tasks.length - visible.length;

  return (
    <div className="rounded-xl border border-border/60 bg-surface-2/70 backdrop-blur-sm overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-surface/50">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-pitch-bright animate-pulse" />
          任务队列
        </div>
        <span className="text-[10px] text-muted tabular-nums">{tasks.filter(t => t.status === "done").length}/{tasks.length}</span>
      </div>

      {/* 任务列表 */}
      <div className="divide-y divide-border/30">
        {visible.map((task, idx) => (
          <div
            key={task.id}
            className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${
              task.status === "running"
                ? "bg-pitch/5"
                : task.status === "done"
                  ? "opacity-50"
                  : ""
            }`}
          >
            {/* 序号 */}
            <span className="text-[9px] text-muted/60 tabular-nums w-4 text-right shrink-0">
              {idx + 1}
            </span>

            {/* 状态图标 */}
            <StatusIcon status={task.status} />

            {/* 任务标签 */}
            <span
              className={`text-[11px] flex-1 leading-tight ${
                task.status === "running"
                  ? "text-foreground font-medium"
                  : task.status === "done"
                    ? "text-muted line-through"
                    : "text-muted/80"
              }`}
            >
              {task.item.type === "match" && (
                <span className="mr-1 text-data-bright">⚽</span>
              )}
              {taskLabel(task.item)}
            </span>

            {/* 状态标签 */}
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                task.status === "running"
                  ? "bg-pitch/20 text-pitch-bright"
                  : task.status === "done"
                    ? "bg-surface text-muted"
                    : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {task.status === "running" ? "进行中" : task.status === "done" ? "完成" : "排队中"}
            </span>
          </div>
        ))}

        {hiddenCount > 0 && (
          <div className="px-3 py-1.5 text-[10px] text-muted text-center">
            +{hiddenCount} 个任务排队中…
          </div>
        )}
      </div>
    </div>
  );
}
