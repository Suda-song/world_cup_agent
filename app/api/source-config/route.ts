import { NextRequest, NextResponse } from "next/server";
import { getPool, isDbConfigured } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

// GET /api/source-config — per-source weights + enabled flags (DBA controls).
export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ config: [] });
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT source, weight, enabled FROM wc_source_config ORDER BY source"
    );
    return NextResponse.json({ config: rows });
  } catch (err) {
    return NextResponse.json(
      { config: [], error: err instanceof Error ? err.message : "db-error" },
      { status: 500 }
    );
  }
}

interface UpdateBody {
  source: string;
  weight?: number;
  enabled?: boolean;
}

// POST /api/source-config — upsert one source's weight/enabled.
export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ saved: false, reason: "db-not-configured" });
  }
  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const source = (body.source || "").slice(0, 32);
  if (!source) return NextResponse.json({ error: "missing-source" }, { status: 400 });
  const weight = Math.max(0, Math.min(3, Number(body.weight ?? 1)));
  const enabled = body.enabled === false ? 0 : 1;

  try {
    await getPool().execute(
      `INSERT INTO wc_source_config (source, weight, enabled) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE weight = VALUES(weight), enabled = VALUES(enabled)`,
      [source, weight, enabled]
    );
    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json(
      { saved: false, error: err instanceof Error ? err.message : "db-error" },
      { status: 500 }
    );
  }
}
