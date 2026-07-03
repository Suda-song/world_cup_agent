interface PageHeaderProps {
  title: string;
  subtitle?: string;
  accent?: "pitch" | "data" | "warn" | "gold";
  right?: React.ReactNode;
}

const accentMap = {
  pitch: "from-pitch-bright to-data",
  data: "from-data to-pitch-bright",
  warn: "from-warn to-gold",
  gold: "from-gold to-warn",
};

export default function PageHeader({
  title,
  subtitle,
  accent = "pitch",
  right,
}: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            className={`w-1 h-7 rounded-full bg-gradient-to-b ${accentMap[accent]}`}
          />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        {subtitle && (
          <p className="text-sm text-muted mt-1.5 ml-3.5">{subtitle}</p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
