"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Star {
  id: number;
  left: number;
  top: number;
  opacity: number;
  duration: number;
  delay: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
}

const PARTICLE_DIRS = [
  { dx: 130, dy: -110 },
  { dx: -100, dy: -130 },
  { dx: 150, dy: 80 },
  { dx: -140, dy: 90 },
  { dx: 60, dy: -160 },
  { dx: -70, dy: 150 },
  { dx: 180, dy: -40 },
  { dx: -170, dy: -50 },
  { dx: 90, dy: 170 },
  { dx: -90, dy: -170 },
  { dx: 120, dy: 120 },
  { dx: -120, dy: -120 },
  { dx: -160, dy: 60 },
  { dx: 160, dy: -70 },
  { dx: 40, dy: 180 },
  { dx: -40, dy: -180 },
  { dx: 200, dy: 20 },
  { dx: -200, dy: -20 },
  { dx: 70, dy: -200 },
  { dx: -80, dy: 190 },
  { dx: 140, dy: -140 },
  { dx: -150, dy: 130 },
  { dx: 100, dy: 200 },
  { dx: -110, dy: -190 },
];

export default function LandingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "kick">("idle");
  const [mounted, setMounted] = useState(false);
  const [stars, setStars] = useState<Star[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const s: Star[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: parseFloat((Math.random() * 100).toFixed(3)),
      top: parseFloat((Math.random() * 100).toFixed(3)),
      opacity: parseFloat((Math.random() * 0.6 + 0.1).toFixed(3)),
      duration: parseFloat((2 + Math.random() * 3).toFixed(2)),
      delay: parseFloat((Math.random() * 3).toFixed(2)),
    }));
    setStars(s);
    setMounted(true);
  }, []);

  const handleEnter = () => {
    if (phase !== "idle") return;

    // 进球瞬间的彩带（在球进网后爆发）
    const pts: Particle[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: parseFloat((38 + Math.random() * 24).toFixed(3)),
      y: parseFloat((22 + Math.random() * 16).toFixed(3)),
    }));
    setParticles(pts);
    setPhase("kick");

    setTimeout(() => {
      sessionStorage.setItem("wc_entered", "1");
      router.push("/agent");
    }, 2000);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#070b14]"
      style={{ zIndex: 9999 }}
    >
      {/* 体育场夜战氛围背景 */}
      <div
        className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
        style={{ opacity: phase === "kick" ? 0 : 1 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1920&q=75"
          alt="World Cup stadium"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
        {/* 暗化 + 上下渐隐，保证文字清晰 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(6,12,24,0.78) 0%, rgba(6,12,24,0.5) 42%, rgba(6,12,24,0.95) 100%)",
          }}
        />
        {/* 品牌色光晕 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(65% 55% at 50% 32%, rgba(16,185,129,0.18), transparent 70%)",
          }}
        />
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {mounted && phase === "idle" && stars.map((s) => (
          <div
            key={s.id}
            className="absolute w-px h-px rounded-full bg-white"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              opacity: s.opacity,
              animation: `star-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* ── 进球过场动画：球射入球网 → GOAL! → 彩带 → 渐入 ── */}
      {phase === "kick" && (
        <div className="absolute inset-0 z-40 overflow-hidden">
          {/* 体育场镜头拉近 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1920&q=75"
            alt="stadium"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            style={{ animation: "goal-kenburns 2s ease-out forwards" }}
          />
          <div className="absolute inset-0 bg-black/45" />

          {/* 球门（顶部） */}
          <svg
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: "16%", width: 200, height: 120, opacity: 0.9 }}
            viewBox="0 0 200 120" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2"
          >
            <rect x="20" y="10" width="160" height="86" />
            {[40, 60, 80, 100, 120, 140, 160].map((x) => <line key={x} x1={x} y1="10" x2={x} y2="96" strokeWidth="0.6" />)}
            {[28, 46, 64, 82].map((y) => <line key={y} x1="20" y1={y} x2="180" y2={y} strokeWidth="0.6" />)}
          </svg>

          {/* 飞入球门的足球 */}
          <div
            className="absolute left-1/2 text-5xl"
            style={{ bottom: "8%", transform: "translateX(-50%)", animation: "goal-shoot 0.85s cubic-bezier(0.34,0.2,0.2,1) forwards" }}
          >
            ⚽
          </div>

          {/* GOAL! 迸发 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="font-black tracking-tight text-6xl md:text-8xl"
              style={{
                background: "linear-gradient(100deg,#34d399,#38bdf8 55%,#fbbf24)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "goal-pop 0.7s 0.9s cubic-bezier(0.2,1.5,0.4,1) both",
              }}
            >
              GOAL!
            </div>
          </div>

          {/* 收尾黑幕，衔接进入应用 */}
          <div className="absolute inset-0 bg-[#060c18]" style={{ animation: "goal-veil 0.5s 1.55s ease-in forwards", opacity: 0 }} />
        </div>
      )}

      {/* 进球彩带 */}
      {particles.map((p, i) => {
        const dir = PARTICLE_DIRS[i % PARTICLE_DIRS.length];
        const color = i % 4 === 0 ? "#34d399" : i % 4 === 1 ? "#fbbf24" : i % 4 === 2 ? "#38bdf8" : "#f472b6";
        return (
          <div
            key={p.id}
            className="absolute w-2 h-2 rounded-sm pointer-events-none z-40"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              background: color,
              transform: "translate(-50%,-50%)",
              animation: phase === "kick" ? `particle-fly-${p.id} 1.1s 0.9s ease-out forwards` : "none",
              opacity: phase === "kick" ? 1 : 0,
              ["--dx" as string]: `${dir.dx}px`,
              ["--dy" as string]: `${dir.dy}px`,
            }}
          />
        );
      })}

      <div
        className="relative z-10 text-center select-none transition-all duration-500"
        style={{
          opacity: phase === "kick" ? 0 : 1,
          transform: phase === "kick" ? "scale(1.05)" : "scale(1)",
          transition: "opacity 0.35s ease, transform 0.35s ease",
        }}
      >
        {/* 东道主 + 赛事标识 */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-xl leading-none">🇨🇦 🇺🇸 🇲🇽</span>
          <span className="px-2.5 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur text-[10px] tracking-[0.25em] text-white/70 uppercase">
            2026 FIFA World Cup
          </span>
        </div>

        <div
          className="text-[64px] mb-4"
          style={{ filter: "drop-shadow(0 6px 24px rgba(0,0,0,0.5))" }}
        >
          ⚽
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-3">
          <span className="shimmer-text">世界杯冠军预测</span>
        </h1>
        <p className="text-white/60 text-sm md:text-base mb-9">
          AI 驱动 · 真实赛程 · 逐场推演 · 深度分析
        </p>

        <button
          ref={buttonRef}
          onClick={handleEnter}
          disabled={phase !== "idle"}
          className="relative group px-12 py-4 rounded-2xl text-base font-bold tracking-wide bg-linear-to-r from-pitch-bright to-data text-black transition-all duration-300 hover:scale-105 hover:shadow-[0_0_50px_rgba(34,197,94,0.55)] disabled:opacity-0 disabled:pointer-events-none overflow-hidden cursor-pointer"
        >
          <span className="relative z-10">开始预测 →</span>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
        </button>

        {/* 赛事数据 */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
          {[
            ["48", "支球队"],
            ["104", "场比赛"],
            ["16", "座城市"],
            ["3", "个东道主"],
          ].map(([n, label]) => (
            <div
              key={label}
              className="px-3.5 py-1.5 rounded-xl border border-white/12 bg-white/5 backdrop-blur flex items-baseline gap-1.5"
            >
              <span className="text-sm font-bold text-white">{n}</span>
              <span className="text-[10px] text-white/50">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 text-white/30 text-[11px] tracking-wide">Elo + 泊松 + 蒙特卡洛 + Qwen AI 驱动</div>
      </div>

      <style>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(2); }
        }
        @keyframes goal-kenburns {
          from { transform: scale(1); }
          to   { transform: scale(1.18); }
        }
        /* 足球从底部飞入顶部球门，带旋转 */
        @keyframes goal-shoot {
          0%   { transform: translateX(-50%) translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateX(-50%) translateY(-58vh) scale(1.5) rotate(900deg); opacity: 1; }
        }
        @keyframes goal-pop {
          0%   { opacity: 0; transform: scale(0.3); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes goal-veil {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        ${Array.from({ length: 30 }, (_, i) => `
          @keyframes particle-fly-${i} {
            to { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))); opacity: 0; }
          }
        `).join("")}
      `}</style>
    </div>
  );
}
