import { NextRequest, NextResponse } from "next/server";
import { getPool, isDbConfigured } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type {
  ViewpointCategory,
  ViewpointScope,
  ViewpointStance,
} from "@/lib/viewpoints";

export const dynamic = "force-dynamic";

const CATEGORIES: ViewpointCategory[] = ["tactics", "form", "history", "opinion"];
const STANCES: ViewpointStance[] = ["positive", "neutral", "negative"];

interface CreateBody {
  scope: ViewpointScope;
  teamId?: string | null;
  category: ViewpointCategory;
  stance: ViewpointStance;
  weight: number;
  content: string;
  author?: string;
  source?: string;
}

// GET /api/viewpoints[?teamId=xxx] — list viewpoints (newest first).
export async function GET(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ viewpoints: [] });
  const teamId = req.nextUrl.searchParams.get("teamId");
  try {
    const pool = getPool();
    const [rows] = teamId
      ? await pool.query<RowDataPacket[]>(
          `SELECT id, scope, team_id AS teamId, category, stance, weight, content, author, source, created_at AS createdAt
             FROM wc_viewpoints WHERE team_id = ? OR scope = 'general' ORDER BY created_at DESC`,
          [teamId]
        )
      : await pool.query<RowDataPacket[]>(
          `SELECT id, scope, team_id AS teamId, category, stance, weight, content, author, source, created_at AS createdAt
             FROM wc_viewpoints ORDER BY created_at DESC LIMIT 500`
        );
    return NextResponse.json({ viewpoints: rows });
  } catch (err) {
    return NextResponse.json(
      { viewpoints: [], error: err instanceof Error ? err.message : "db-error" },
      { status: 500 }
    );
  }
}

// POST /api/viewpoints — create one viewpoint.
export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ saved: false, reason: "db-not-configured" }, { status: 200 });
  }
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const scope: ViewpointScope = body.scope === "general" ? "general" : "team";
  const category = CATEGORIES.includes(body.category) ? body.category : null;
  const stance = STANCES.includes(body.stance) ? body.stance : "neutral";
  const weight = Math.max(1, Math.min(5, Number(body.weight) || 3));
  const content = (body.content || "").trim().slice(0, 500);
  const teamId = scope === "team" ? (body.teamId || "").trim() : null;
  const source = (body.source || "其他").slice(0, 32);

  if (!category) return NextResponse.json({ error: "invalid-category" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "empty-content" }, { status: 400 });
  if (scope === "team" && !teamId)
    return NextResponse.json({ error: "missing-team" }, { status: 400 });

  try {
    const [res] = await getPool().execute<ResultSetHeader>(
      `INSERT INTO wc_viewpoints (scope, team_id, category, stance, weight, content, author, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [scope, teamId, category, stance, weight, content, (body.author || "").slice(0, 64) || null, source]
    );
    return NextResponse.json({ saved: true, id: res.insertId });
  } catch (err) {
    return NextResponse.json(
      { saved: false, error: err instanceof Error ? err.message : "db-error" },
      { status: 500 }
    );
  }
}

// DELETE /api/viewpoints?id=123 — remove one viewpoint.
export async function DELETE(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ deleted: false });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "missing-id" }, { status: 400 });
  try {
    await getPool().execute("DELETE FROM wc_viewpoints WHERE id = ?", [id]);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { deleted: false, error: err instanceof Error ? err.message : "db-error" },
      { status: 500 }
    );
  }
}
