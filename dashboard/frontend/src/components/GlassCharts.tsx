import React, { useMemo, useState } from 'react';

interface SeriesPoint {
  label: string;
  sublabel?: string;
  value: number;
  highlight?: boolean;
}

export const GlassAreaChart: React.FC<{
  points: SeriesPoint[];
  unit?: string;
  height?: number;
}> = ({ points, unit = '', height = 210 }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 720;
  const padX = 16;
  const padY = 18;

  const geometry = useMemo(() => {
    if (!points.length) return null;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const coords = points.map((p, idx) => {
      const x = padX + (points.length === 1 ? innerW / 2 : (idx / (points.length - 1)) * innerW);
      const y = padY + innerH - ((p.value - min) / span) * innerH;
      return { x, y, ...p };
    });

    let linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const cx = (prev.x + curr.x) / 2;
      linePath += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`;
    return { coords, linePath, areaPath, min, max };
  }, [points, height]);

  if (!geometry) {
    return (
      <div className="h-[210px] flex items-center justify-center text-sm opacity-60">
        No chart telemetry yet
      </div>
    );
  }

  const active = hoverIdx !== null ? geometry.coords[hoverIdx] : null;

  return (
    <div className="relative w-full select-none">
      {active && (
        <div
          className="pointer-events-none absolute top-1 z-10 m3-glass-elevated px-3 py-1.5 rounded-2xl text-xs tabular-nums transition-all"
          style={{
            left: `${Math.min(82, Math.max(8, (active.x / width) * 100))}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold" style={{ color: 'var(--m3-primary)' }}>
            {active.value.toLocaleString()} {unit}
          </div>
          <div className="opacity-75 text-[11px]">{active.label}</div>
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="m3AreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--m3-primary)" stopOpacity="0.42" />
            <stop offset="100%" stopColor="var(--m3-primary)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={padX}
            x2={width - padX}
            y1={padY + (height - padY * 2) * pct}
            y2={padY + (height - padY * 2) * pct}
            stroke="var(--m3-glass-border)"
            strokeDasharray="4 5"
          />
        ))}

        <path d={geometry.areaPath} fill="url(#m3AreaGrad)" />
        <path
          d={geometry.linePath}
          fill="none"
          stroke="var(--m3-primary)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />

        {active && (
          <>
            <line
              x1={active.x}
              x2={active.x}
              y1={padY}
              y2={height - padY}
              stroke="var(--m3-primary)"
              strokeOpacity="0.45"
              strokeDasharray="3 3"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r="5.5"
              fill="var(--m3-primary)"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </>
        )}

        {geometry.coords.map((pt, idx) => (
          <rect
            key={idx}
            x={pt.x - (width / geometry.coords.length) / 2}
            y={0}
            width={width / geometry.coords.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(idx)}
          />
        ))}
      </svg>
      <div className="flex justify-between text-[11px] opacity-60 px-2 mt-1 tabular-nums">
        <span>{points[0]?.label}</span>
        <span>
          Min {geometry.min.toLocaleString()} · Max {geometry.max.toLocaleString()} {unit}
        </span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
};

export const FeeHistogramChart: React.FC<{
  buckets: Array<{ bucket: string; count: number; vbytes: number }>;
}> = ({ buckets }) => {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="grid grid-cols-6 gap-3 items-end h-44 pt-4">
      {buckets.map((b) => {
        const pct = Math.max(8, Math.round((b.count / maxCount) * 100));
        return (
          <div key={b.bucket} className="flex flex-col items-center gap-2 h-full justify-end group">
            <div className="text-[11px] font-medium tabular-nums opacity-75 group-hover:opacity-100">
              {b.count.toLocaleString()}
            </div>
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-2xl transition-all duration-300 group-hover:brightness-125"
                style={{
                  height: `${pct}%`,
                  background: 'linear-gradient(180deg, var(--m3-primary) 0%, var(--m3-primary-container) 100%)',
                  border: '1px solid var(--m3-glass-border)',
                }}
                title={`${b.bucket} lit/vB: ${b.count} TXs (${(b.vbytes / 1000).toFixed(1)} kvB)`}
              />
            </div>
            <div className="text-xs font-medium opacity-80 tabular-nums">{b.bucket}</div>
          </div>
        );
      })}
    </div>
  );
};

export const DualSparkline: React.FC<{
  samples: Array<{ rx: number; tx: number }>;
}> = ({ samples }) => {
  const w = 360;
  const h = 72;
  if (samples.length < 2) {
    return (
      <div className="h-[72px] flex items-center text-xs opacity-60">
        Collecting live bandwidth samples…
      </div>
    );
  }
  const maxVal = Math.max(1, ...samples.flatMap((s) => [s.rx, s.tx]));
  const buildPath = (key: 'rx' | 'tx') =>
    samples
      .map((s, i) => {
        const x = (i / (samples.length - 1)) * w;
        const y = h - 8 - (s[key] / maxVal) * (h - 16);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[72px]">
      <path d={buildPath('rx')} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
      <path d={buildPath('tx')} fill="none" stroke="var(--m3-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
