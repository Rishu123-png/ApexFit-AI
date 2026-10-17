/** Lightweight, dependency-free SVG charts. */

export function ProgressRing({
  percent,
  size = 88,
  stroke = 8,
  label,
  sublabel,
  tone = 'var(--electric)',
}: {
  percent: number; // 0..1
  size?: number;
  stroke?: number;
  label: string;
  sublabel?: string;
  tone?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, percent));
  return (
    <div className="relative inline-flex items-center justify-center" role="img" aria-label={`${label} ${Math.round(clamped * 100)}%`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 600ms ease', filter: `drop-shadow(0 0 6px ${tone})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none">{label}</span>
        {sublabel && <span className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{sublabel}</span>}
      </div>
    </div>
  );
}

export function MiniBars({
  data,
  height = 96,
  tone = 'var(--electric)',
  highlightLast = true,
  unit = '',
}: {
  data: { label: string; value: number }[];
  height?: number;
  tone?: string;
  highlightLast?: boolean;
  unit?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2" style={{ height }} role="img"
      aria-label={data.map((d) => `${d.label}: ${d.value}${unit}`).join(', ')}>
      {data.map((d, i) => {
        const h = Math.max(3, (d.value / max) * (height - 22));
        const last = highlightLast && i === data.length - 1;
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-semibold text-slate-300">{d.value > 0 ? Math.round(d.value) : ''}</span>
            <div
              className="w-full max-w-[26px] rounded-t-md transition-all duration-500"
              style={{
                height: h,
                background: last
                  ? `linear-gradient(180deg, ${tone}, rgba(34,224,255,0.55))`
                  : 'rgba(148,163,184,0.25)',
                boxShadow: last && d.value > 0 ? '0 0 14px rgba(47,139,255,0.55)' : undefined,
              }}
            />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MacroBar({
  label,
  value,
  target,
  unit,
  tone,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  tone: string;
}) {
  const pct = Math.min(1, target > 0 ? value / target : 0);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">
          {Math.round(value)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct * 100}%`, background: tone, boxShadow: `0 0 10px ${tone}` }}
        />
      </div>
    </div>
  );
}
