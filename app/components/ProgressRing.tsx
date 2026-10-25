'use client';

export default function ProgressRing({ percent, color, label, sublabel }: { percent: number; color: string; label: string; sublabel: string }) {
  const size = 68;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--fill-3)" strokeWidth={stroke} fill="none" />
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
            style={{ transition: 'stroke-dashoffset 0.6s var(--ease)' }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center tnum"
          style={{ fontSize: 15, fontWeight: 640, letterSpacing: '-0.02em', color: 'var(--ink)' }}
        >
          {Math.round(percent)}
          <span style={{ fontSize: 10.5, fontWeight: 560, color: 'var(--ink-3)', marginLeft: 1 }}>%</span>
        </div>
      </div>
      <div className="text-center leading-tight">
        <p style={{ fontSize: 12, fontWeight: 580, color: 'var(--ink-2)', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '2px 0 0' }}>{sublabel}</p>
      </div>
    </div>
  );
}
