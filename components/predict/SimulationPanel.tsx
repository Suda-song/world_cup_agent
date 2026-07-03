"use client";

import { useAppStore } from "@/lib/store";
import { teamName, teamFlag } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/data/loader";

export default function SimulationPanel() {
  const { running, progress, simCount, useMood, runSimulation, setSimCount, setUseMood, mcResult } =
    useAppStore();

  const topChamp = mcResult?.topChampions?.[0];
  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg">蒙特卡洛模拟引擎</h3>
          <p className="text-xs text-muted mt-0.5">
            每次模拟完整跑完 小组赛→32强→16强→8强→4强→决赛，聚合各队晋级概率
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useMood}
              onChange={(e) => setUseMood(e.target.checked)}
              className="accent-pitch-bright w-3.5 h-3.5"
            />
            球员心情修正
          </label>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">模拟次数</span>
            <select
              value={simCount}
              onChange={(e) => setSimCount(Number(e.target.value))}
              className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-xs"
            >
              <option value={1000}>1,000</option>
              <option value={3000}>3,000</option>
              <option value={5000}>5,000</option>
              <option value={10000}>10,000</option>
            </select>
          </div>
          <button
            onClick={() => runSimulation()}
            disabled={running}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-pitch to-pitch-bright text-white text-sm font-semibold disabled:opacity-50 hover:brightness-110 transition"
          >
            {running ? "模拟中…" : "▶ 运行模拟"}
          </button>
        </div>
      </div>

      {running && (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pitch-bright to-data transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-[11px] text-muted mt-1.5 font-mono">
            {progress.done.toLocaleString()} / {progress.total.toLocaleString()} 次模拟
          </div>
        </div>
      )}

      {mcResult && !running && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="最可能冠军"
            value={topChamp ? `${teamFlag(topChamp.teamId)} ${teamName(topChamp.teamId)}` : "—"}
            sub={topChamp ? `${(topChamp.pct * 100).toFixed(1)}% 夺冠概率` : ""}
            color="text-gold"
          />
          <StatCard
            label="模拟总次数"
            value={mcResult.n.toLocaleString()}
            sub="次完整锦标赛"
            color="text-data"
          />
          <StatCard
            label="夺冠候选"
            value={`${mcResult.topChampions.filter((c) => c.pct > 0.01).length}`}
            sub="概率 >1% 的球队"
            color="text-pitch-bright"
          />
          <StatCard
            label="最大冷门"
            value={
              mcResult.topChampions.length > 0
                ? biggestUpset(mcResult.topChampions)
                : "—"
            }
            sub="低排名高概率"
            color="text-warn"
          />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="card-2 p-3">
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className={`text-base font-bold mt-1 ${color}`}>{value}</div>
      <div className="text-[10px] text-muted mt-0.5">{sub}</div>
    </div>
  );
}

function biggestUpset(
  top: { teamId: string; count: number; pct: number }[]
): string {
  const sorted = [...top].sort((a, b) => {
    const ra = getTeam(a.teamId)?.fifaRank ?? 99;
    const rb = getTeam(b.teamId)?.fifaRank ?? 99;
    return rb - ra; // 排名越靠后(数字大)越冷门
  });
  const c = sorted[0];
  if (!c) return "—";
  return `${teamFlag(c.teamId)} ${teamName(c.teamId)}`;
}
