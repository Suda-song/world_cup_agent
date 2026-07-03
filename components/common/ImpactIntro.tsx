// Shows at the top of every config/data-analysis page so users immediately
// understand: what this page does, how it flows into the prediction, where to
// see the effect.
import Link from "next/link";

interface Step {
  icon: string;
  label: string;
  desc: string;
}
interface ImpactIntroProps {
  title: string;
  subtitle: string;
  steps: Step[];
  // "See the effect at" link (optional)
  resultLink?: { href: string; label: string };
}

export default function ImpactIntro({ title, subtitle, steps, resultLink }: ImpactIntroProps) {
  return (
    <div className="rounded-2xl border border-data/25 bg-data/5 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-data-bright mb-1">
            配置说明 · 影响预测
          </div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">{subtitle}</p>
        </div>
        {resultLink && (
          <Link
            href={resultLink.href}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-pitch/20 text-pitch-bright text-xs font-medium hover:bg-pitch/30 transition-all whitespace-nowrap"
          >
            查看预测结果 → {resultLink.label}
          </Link>
        )}
      </div>

      {/* Flow steps */}
      <div className="flex flex-wrap items-start gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-start gap-2 card-2 px-3 py-2 min-w-[140px]">
              <span className="text-base mt-0.5">{step.icon}</span>
              <div>
                <div className="text-xs font-semibold">{step.label}</div>
                <div className="text-[10px] text-muted">{step.desc}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <span className="text-data-bright text-sm font-bold">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
