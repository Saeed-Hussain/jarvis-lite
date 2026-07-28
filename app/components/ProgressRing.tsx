'use client';

export default function ProgressRing({ percent, color, label, sublabel }: { percent: number; color: string; label: string; sublabel: string }) {
  const size = 66;
  const stroke = 5.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--jarvis-border)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-base font-bold">{Math.round(percent)}%</div>
      </div>
      <div className="text-center leading-tight">
        <p className="text-[10px] font-medium tracking-wide" style={{ color: 'var(--jarvis-subtext)' }}>
          {label}
        </p>
        <p className="text-[10px] font-semibold" style={{ color }}>
          {sublabel}
        </p>
      </div>
    </div>
  );
}
