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
  const [phase, setPhase] = useState<"idle" | "glow" | "expand">("idle");
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

    const pts: Particle[] = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: parseFloat((35 + Math.random() * 30).toFixed(3)),
      y: parseFloat((35 + Math.random() * 30).toFixed(3)),
    }));
    setParticles(pts);
    setPhase("glow");

    setTimeout(() => setPhase("expand"), 600);
    setTimeout(() => {
      sessionStorage.setItem("wc_entered", "1");
      router.push("/agent");
    }, 1800);
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center overflow-hidden transition-colors duration-1000 ${
        phase === "expand" ? "bg-white" : "bg-[#070b14]"
      }`}
      style={{ zIndex: 9999 }}
    >
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

      {(phase === "glow" || phase === "expand") && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 300,
            height: 300,
            background: "radial-gradient(circle, #22c55e 0%, #0ea5e9 40%, transparent 70%)",
            transform: phase === "expand" ? "scale(60)" : "scale(0)",
            opacity: phase === "expand" ? 1 : 0.8,
            transition: "transform 1.2s cubic-bezier(0.16,1,0.3,1), opacity 1.2s ease",
          }}
        />
      )}

      {particles.map((p, i) => {
        const dir = PARTICLE_DIRS[i % PARTICLE_DIRS.length];
        const color = i % 3 === 0 ? "#22c55e" : i % 3 === 1 ? "#fbbf24" : "#38bdf8";
        return (
          <div
            key={p.id}
            className="absolute w-2 h-2 rounded-full pointer-events-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              background: color,
              transform: "translate(-50%,-50%)",
              animation:
                phase === "glow" || phase === "expand"
                  ? `particle-fly-${p.id} 1s ease-out forwards`
                  : "none",
              ["--dx" as string]: `${dir.dx}px`,
              ["--dy" as string]: `${dir.dy}px`,
            }}
          />
        );
      })}

      <div
        className="relative z-10 text-center select-none transition-all duration-500"
        style={{
          opacity: phase === "expand" ? 0 : 1,
          transform: phase === "expand" ? "scale(0.9)" : "scale(1)",
        }}
      >
        <div
          className="text-[80px] mb-6 transition-transform duration-300"
          style={{
            transform: phase === "glow" ? "scale(1.25)" : "scale(1)",
            filter: phase === "glow" ? "drop-shadow(0 0 40px #22c55e)" : "none",
          }}
        >
          ⚽
        </div>

        <div className="mb-2 text-xs tracking-[0.3em] text-white/40 uppercase">
          2026 FIFA World Cup
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-2">
          世界杯预测
        </h1>
        <p className="text-white/40 text-sm mb-10">AI 驱动 · 真实赛程 · 深度分析</p>

        <button
          ref={buttonRef}
          onClick={handleEnter}
          disabled={phase !== "idle"}
          className="relative group px-10 py-4 rounded-2xl text-base font-bold tracking-wide bg-linear-to-r from-pitch-bright to-data text-black transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] disabled:opacity-0 disabled:pointer-events-none overflow-hidden cursor-pointer"
        >
          <span className="relative z-10">开始预测</span>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
        </button>

        <div className="mt-6 text-white/20 text-xs">Elo + 泊松 + 蒙特卡洛 + Qwen AI</div>
      </div>

      <style>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(2); }
        }
        ${Array.from({ length: 24 }, (_, i) => `
          @keyframes particle-fly-${i} {
            to { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))); opacity: 0; }
          }
        `).join("")}
      `}</style>
    </div>
  );
}
