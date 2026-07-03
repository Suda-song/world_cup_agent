interface MoodMeterProps {
  value: number; // 0-100
  label: string;
  invert?: boolean; // 压力/疲劳越低越好
  size?: number;
}

export default function MoodMeter({
  value,
  label,
  invert = false,
  size = 72,
}: MoodMeterProps) {
  const radius = (size - 8) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;

  // 颜色：invert 时高值=差(红)；非 invert 时高值=好(绿)
  const good = invert ? value < 40 : value >= 60;
  const ok = invert ? value < 65 : value >= 40;
  const color = good ? "#22c55e" : ok ? "#fbbf24" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1f2b40"
            strokeWidth={5}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold" style={{ color }}>
            {Math.round(value)}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted mt-1">{label}</span>
    </div>
  );
}
