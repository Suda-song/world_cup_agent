import { getTeam } from "@/lib/data/loader";

export function TeamBadge({
  teamId,
  size = "md",
  showName = true,
}: {
  teamId: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}) {
  const team = getTeam(teamId);
  if (!team) return <span className="text-muted">?</span>;
  const fs = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={fs}>{team.flag}</span>
      {showName && <span className="font-medium">{team.name}</span>}
    </span>
  );
}

export function teamName(teamId: string): string {
  return getTeam(teamId)?.name ?? teamId;
}

export function teamFlag(teamId: string): string {
  return getTeam(teamId)?.flag ?? "🏳️";
}
