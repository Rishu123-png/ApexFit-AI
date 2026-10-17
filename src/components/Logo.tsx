export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lg-a" x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="#2f8bff" />
          <stop offset="1" stopColor="#22e0ff" />
        </linearGradient>
      </defs>
      <path
        d="M24 2 43 13v22L24 46 5 35V13L24 2z"
        fill="rgba(47,139,255,0.08)"
        stroke="url(#lg-a)"
        strokeWidth="2.5"
      />
      <path
        d="M12 26h6l3-9 4 14 3-8h8"
        stroke="url(#lg-a)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoWord({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-lg font-extrabold tracking-tight">
        Apex<span className="neon-text">Fit</span>
        <span className="ml-1.5 align-middle text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          AI
        </span>
      </span>
    </span>
  );
}
