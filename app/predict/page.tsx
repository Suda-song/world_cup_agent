"use client";

import { useEffect } from "react";
import PageHeader from "@/components/common/PageHeader";
import SimulationPanel from "@/components/predict/SimulationPanel";
import ChampionChart from "@/components/predict/ChampionChart";
import StageProgression from "@/components/predict/StageProgression";
import ProbabilityHeatmap from "@/components/predict/ProbabilityHeatmap";
import { useAppStore } from "@/lib/store";

export default function PredictPage() {
  const { mcResult, runSimulation, running, agentInitialized } = useAppStore();

  // Agent 已跑过预测则直接使用其结果，不重复模拟
  useEffect(() => {
    if (!mcResult && !running && !agentInitialized) runSimulation(3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="各阶段晋级预测"
        subtitle="蒙特卡洛模拟完整锦标赛，预测 48 队在各淘汰阶段的抵达概率"
        accent="pitch"
      />

      <div className="space-y-5">
        <SimulationPanel />

        {mcResult ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChampionChart />
              <StageProgression />
            </div>
            <ProbabilityHeatmap />
          </>
        ) : (
          <div className="card p-12 text-center text-muted">
            <div className="text-4xl mb-3 animate-pulse-soft">⚽</div>
            <div>引擎正在跑模拟，请稍候…</div>
          </div>
        )}
      </div>
    </div>
  );
}
