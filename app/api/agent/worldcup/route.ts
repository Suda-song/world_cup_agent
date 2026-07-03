import { NextRequest, NextResponse } from "next/server";
import { runWorldCupAgent } from "@/lib/agent/worldcupAgent";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      task?: string;
      simCount?: number;
    };
    const result = await runWorldCupAgent(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        agent: "WorldCup Predictor Agent",
        error: err instanceof Error ? err.message : "agent-error",
      },
      { status: 500 },
    );
  }
}
