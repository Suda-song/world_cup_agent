// 2026 FIFA World Cup — real tournament schedule (USA/Canada/Mexico)
// Dates are based on the official 2026 WC calendar.

export interface TournamentStage {
  key: "group" | "r32" | "r16" | "qf" | "sf" | "final";
  label: string;
  labelFull: string;
  start: string; // YYYY-MM-DD
  end: string;
}

export const SCHEDULE: TournamentStage[] = [
  { key: "group", label: "小组赛",  labelFull: "小组赛",    start: "2026-06-11", end: "2026-06-27" },
  { key: "r32",   label: "32 强",   labelFull: "32 强淘汰赛", start: "2026-06-28", end: "2026-07-03" },
  { key: "r16",   label: "16 强",   labelFull: "16 强淘汰赛", start: "2026-07-04", end: "2026-07-07" },
  { key: "qf",    label: "8 强",    labelFull: "1/4 决赛",   start: "2026-07-09", end: "2026-07-11" },
  { key: "sf",    label: "4 强",    labelFull: "半决赛",      start: "2026-07-14", end: "2026-07-15" },
  { key: "final", label: "决赛",    labelFull: "世界杯决赛",   start: "2026-07-19", end: "2026-07-19" },
];

export type StageStatus = "done" | "live" | "next" | "upcoming";

export interface StageInfo {
  stage: TournamentStage;
  status: StageStatus;
  isKnockout: boolean;
}

// Return each stage's status relative to a given date (defaults to now).
export function getScheduleStatus(today = new Date()): StageInfo[] {
  const d = today.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const doneIdx = SCHEDULE.filter((s) => s.end < d).length;
  const currentIdx = SCHEDULE.findIndex((s) => s.start <= d && d <= s.end);
  // If today is between stages (gap days), currentIdx is -1; "next" is doneIdx.
  const nextIdx = currentIdx === -1 ? doneIdx : -1;

  return SCHEDULE.map((stage, i) => {
    let status: StageStatus;
    if (i < doneIdx) status = "done";
    else if (i === currentIdx) status = "live";
    else if (i === nextIdx) status = "next"; // about to start
    else status = "upcoming";
    return { stage, status, isKnockout: stage.key !== "group" };
  });
}

// The one stage that is "live" or "next" (the focal point).
export function currentFocusStage(today = new Date()): StageInfo {
  const statuses = getScheduleStatus(today);
  return (
    statuses.find((s) => s.status === "live") ??
    statuses.find((s) => s.status === "next") ??
    statuses[statuses.length - 1]
  );
}

export function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}
