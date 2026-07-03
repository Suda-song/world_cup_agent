// 数据同步脚本（纯 JS，无需 TS 运行器）
// 用法: 配置 FOOTBALL_API_KEY 后执行 `npm run sync-data` 抓取真实数据 → 写入 data/cache.json
// 未配置 key 时，应用直接使用内置种子数据（无需同步）

import fs from "fs";
import path from "path";

const BASE = "https://v3.football.api-sports.io";

async function main() {
  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "cache.json");

  const key = process.env.FOOTBALL_API_KEY;
  if (!key) {
    console.log("📦 未配置 FOOTBALL_API_KEY，应用将直接使用内置种子数据（48队/球员/历史），无需同步。");
    console.log("   如需抓取真实数据：FOOTBALL_API_KEY=你的key npm run sync-data");
    return;
  }

  console.log("🔑 检测到 FOOTBALL_API_KEY，开始抓取真实数据...");
  try {
    const res = await fetch(`${BASE}/teams?league=1&season=2026`, {
      headers: { "x-apisports-key": key },
    });
    if (!res.ok) throw new Error(`API 请求失败: ${res.status}`);
    const json = await res.json();
    const list = json.response || [];

    // 注意：此处为抓取能力演示，真实场景需按 API-Football 文档
    // 进一步映射 Elo/6维评分/球员心情等富字段
    const teams = list.map((t) => ({
      id: String(t.team?.id ?? ""),
      name: t.team?.name ?? "",
      flag: "🏳️",
      elo: 1500,
      fifaRank: 0,
      group: "?",
      confederation: "UEFA",
      style: "balanced",
      ratings: { attack: 65, defense: 65, midfield: 65, speed: 65, experience: 65, form: 65 },
    }));

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "api",
      teams,
      players: [],
      history: [],
    };
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`✅ 抓取到 ${teams.length} 支球队，缓存已写入: ${outPath}`);
    console.log("   提示：富字段(Elo/6维评分/心情)需补充映射后效果更佳。");
  } catch (e) {
    console.error("⚠️ 抓取失败:", e.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
