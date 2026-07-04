import { NextRequest, NextResponse } from "next/server";
import { simulateDetailedTournament } from "@/lib/prediction/detailedSim";
import { TEAMS } from "@/lib/data/teams";
import { teamMoodModifier } from "@/lib/mood/moodModel";
import { computeViewpointMods } from "@/lib/viewpoints";
import { getLiveContext, loadViewpoints } from "@/lib/agent/worldcupAgent";

export const dynamic = "force-dynamic";

// 后端详细赛程模拟：完整赛程树 + 每场比分 + 推理链路。计算全在服务端。
export async function POST(req: NextRequest) {
  let body: { useMood?: boolean } = {};
  try {
    body = (await req.json()) as { useMood?: boolean };
  } catch {
    /* defaults */
  }
  const useMood = body.useMood !== false;

  const [live, vpData] = await Promise.all([getLiveContext(), loadViewpoints()]);
  const vpMods = computeViewpointMods(
    vpData.viewpoints,
    TEAMS.map((t) => t.id),
    vpData.sourceConfig,
  );
  const mods: Record<string, number> = {};
  for (const t of TEAMS) {
    mods[t.id] = (useMood ? teamMoodModifier(t.id) ?? 1 : 1) * (vpMods[t.id] ?? 1);
  }

  const bracket = simulateDetailedTournament(
    mods,
    live.context?.knockoutMatches ?? [],
    live.context?.groupMatches ?? [],
  );
  return NextResponse.json({
    bracket,
    meta: {
      scheduleSource: live.context ? "football-data.org" : "内置种子赛程",
      finishedMatchCount: live.finishedMatchCount,
    },
  });
}
