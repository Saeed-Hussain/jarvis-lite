'use client';

import { memo } from 'react';

/**
 * One system gauge. Past 65% it turns amber and past 85% red, whatever its own
 * colour — the colour is identity, the warning overrides it.
 */
function MetricBar({ label, color, value, text }: { label: string; color: string; value: number; text: string }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const barCol = v > 85 ? 'var(--bad)' : v > 65 ? 'var(--warn)' : color;
  return (
    <div className="mk-metric">
      <div className="mk-metric-top">
        <span className="mk-metric-label">{label}</span>
        <span className="mk-metric-value mono tnum" style={{ color: text !== '--' && v > 65 ? barCol : undefined }}>
          {text}
        </span>
      </div>
      <div className="mk-metric-track">
        <div className="mk-metric-fill" style={{ transform: `scaleX(${v / 100})`, background: barCol }} />
      </div>
    </div>
  );
}

export default memo(MetricBar);
