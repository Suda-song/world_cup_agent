import { NextRequest, NextResponse } from "next/server";
import { getPool, isDbConfigured } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const dynamic = "force-dynamic";

interface SavePredictionBody {
  championId: string;
  championName: string;
  probability: number; // 0-100 (pct)
  runnerUpId?: string;
  runnerUpName?: string;
  simCount: number;
  useMood: boolean;
}

// POST /api/predictions — persist one tournament prediction result.
export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { saved: false, reason: "db-not-configured" },
      { status: 200 }
    );
  }

  let body: SavePredictionBody;
  try {
    body = (await req.json()) as SavePredictionBody;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  if (!body.championId || !body.championName) {
    return NextResponse.json({ error: "missing-champion" }, { status: 400 });
  }

  try {
    const [res] = await getPool().execute<ResultSetHeader>(
      `INSERT INTO wc_predictions
         (champion_id, champion_name, probability, runner_up_id, runner_up_name, sim_count, use_mood)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        body.championId,
        body.championName,
        Number(body.probability) || 0,
        body.runnerUpId ?? null,
        body.runnerUpName ?? null,
        Number(body.simCount) || 0,
        body.useMood ? 1 : 0,
      ]
    );
    return NextResponse.json({ saved: true, id: res.insertId });
  } catch (err) {
    return NextResponse.json(
      { saved: false, error: err instanceof Error ? err.message : "db-error" },
      { status: 500 }
    );
  }
}

// GET /api/predictions — recent predictions + champion aggregate.
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ recent: [], leaderboard: [] });
  }

  try {
    const pool = getPool();
    const [recent] = await pool.query<RowDataPacket[]>(
      `SELECT id, champion_id, champion_name, probability, runner_up_name, sim_count, use_mood, created_at
         FROM wc_predictions ORDER BY created_at DESC LIMIT 100`
    );
    const [leaderboard] = await pool.query<RowDataPacket[]>(
      `SELECT champion_id, champion_name, COUNT(*) AS wins, AVG(probability) AS avg_prob
         FROM wc_predictions GROUP BY champion_id, champion_name
         ORDER BY wins DESC LIMIT 10`
    );
    return NextResponse.json({ recent, leaderboard });
  } catch (err) {
    return NextResponse.json(
      { recent: [], leaderboard: [], error: err instanceof Error ? err.message : "db-error" },
      { status: 500 }
    );
  }
}
