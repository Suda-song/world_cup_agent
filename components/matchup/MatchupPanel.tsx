"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/common/PageHeader";
import MatchupRadar from "@/components/matchup/MatchupRadar";
import { TEAMS } from "@/lib/data/teams";
import { getTeam, getFindHistory } from "@/lib/data/loader";
import { predictMatchup, styleClash } from "@/lib/prediction/poisson";
import { computeMoodMods } from "@/lib/store";
import type { PlayStyle } from "@/lib/types";

const STYLE_LABEL: Record<PlayStyle, string> = {
  possession: "控球",
  counter: "反击",
  press: "高压",
  defensive: "防守",
  balanced: "均衡",
};

export default function MatchupPanel() {
  const [aId, setAId] = useState("arg");
  const [bId, setBId] = useState("fra");

  const a = getTeam(aId)!;
  const b = getTeam(bId)!;

  const pred = useMemo(
    () => predictMatchup(a, b, computeMoodMods()),
    [a, b]
  );
  const clash = styleClash(a.style, b.style);
  const history = getFindHistory(aId, bId);

  const aAdv = clash[0];
  const bAdv = clash[1];

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="竞争对抗设计"
        subtitle="两两对战的胜平负预测、战术克制与六维能力对比"
        accent="warn"
      />

      <div className="card p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <TeamSelect label="主队" value={aId} onChange={setAId} accent="#22c55e" />
          <div className="text-center">
            <div className="text-2xl font-bold text-muted">VS</div>
            <div className="text-[11px] text-muted mt-1">泊松预测</div>
          </div>
          <TeamSelect label="客队" value={bId} onChange={setBId} accent="#f97316" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="card p-5">
          <h3 className="font-bold mb-4">对战预测分析</h3>

          <div className="space-y-3 mb-5">
            <ProbBar label={`${a.flag} ${a.name} 胜`} value={pred.winA} color="#22c55e" />
            <ProbBar label="平局" value={pred.draw} color="#fbbf24" />
            <ProbBar label={`${b.flag} ${b.name} 胜`} value={pred.winB} color="#f97316" />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="card-2 p-3 text-center">
              <div className="text-[10px] text-muted">预期比分</div>
              <div className="text-2xl font-bold mt-1">
                {pred.likelyScore.a} : {pred.likelyScore.b}
              </div>
            </div>
            <div className="card-2 p-3 text-center">
              <div className="text-[10px] text-muted">期望进球</div>
              <div className="text-2xl font-bold mt-1 font-mono">
                {pred.expectedScoreA.toFixed(2)} : {pred.expectedScoreB.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="card-2 p-3 mb-3">
            <div className="text-[10px] text-muted mb-1.5">战术风格克制</div>
            <div className="flex items-center justify-between text-sm">
              <span className={aAdv > 1.02 ? "text-pitch-bright font-bold" : ""}>
                {a.flag} {STYLE_LABEL[a.style]} {aAdv > 1.02 ? "✓ 占优" : ""}
              </span>
              <span className="text-muted text-xs">
                {aAdv > 1.05
                  ? `${a.name}的${STYLE_LABEL[a.style]}克制${STYLE_LABEL[b.style]}`
                  : bAdv > 1.05
                  ? `${b.name}的${STYLE_LABEL[b.style]}克制${STYLE_LABEL[a.style]}`
                  : "风格相容，无明显克制"}
              </span>
              <span className={bAdv > 1.02 ? "text-warn font-bold" : ""}>
                {bAdv > 1.02 ? "占优 ✓" : ""} {STYLE_LABEL[b.style]} {b.flag}
              </span>
            </div>
          </div>

          {history && (
            <div className="card-2 p-3">
              <div className="text-[10px] text-muted mb-1.5">历史交锋</div>
              <div className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span>{a.flag} {a.name}</span>
                  <span className="font-mono text-pitch-bright">
                    {history.teamA === aId ? history.aWins : history.bWins} 胜
                  </span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span>平局</span>
                  <span className="font-mono text-gold">{history.draws} 平</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{b.flag} {b.name}</span>
                  <span className="font-mono text-warn">
                    {history.teamA === bId ? history.aWins : history.bWins} 胜
                  </span>
                </div>
                <div className="text-[10px] text-muted mt-2 pt-2 border-t border-border">
                  {history.lastMeeting}
                </div>
              </div>
            </div>
          )}
        </div>

        <MatchupRadar aId={aId} bId={bId} />
      </div>
    </div>
  );
}

function TeamSelect({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted mb-1.5" style={{ color: accent }}>
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm font-medium"
      >
        {[...TEAMS]
          .sort((a, b) => b.elo - a.elo)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.flag} {t.name} (Elo {t.elo})
            </option>
          ))}
      </select>
    </div>
  );
}

function ProbBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="font-mono font-bold" style={{ color }}>
          {(value * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full animate-bar"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}
