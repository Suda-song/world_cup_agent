import { NextRequest, NextResponse } from "next/server";
import { runMonteCarlo } from "@/lib/prediction/monteCarlo";
import { TEAMS } from "@/lib/data/teams";
import { teamMoodModifier } from "@/lib/mood/moodModel";
import { computeViewpointMods } from "@/lib/viewpoints";
import { getLiveContext, loadViewpoints } from "@/lib/agent/worldcupAgent";

export const dynamic = "force-dynamic";

// 后端蒙特卡洛模拟：晋级/夺冠概率。前端只负责触发与展示，计算全在服务端。
export async function POST(req: NextRequest) {
  let body: { count?: number; useMood?: boolean } = {};
  try {
    body = (await req.json()) as { count?: number; useMood?: boolean };
  } catch {
    /* use defaults */
  }
  const count = Math.max(500, Math.min(10000, Number(body.count) || 3000));
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

  const result = runMonteCarlo(count, mods, undefined, live.context);
  return NextResponse.json({
    ...result,
    meta: {
      scheduleSource: live.context ? "football-data.org" : "内置种子赛程",
      finishedMatchCount: live.finishedMatchCount,
      viewpointCount: vpData.viewpoints.length,
      useMood,
    },
  });
}
