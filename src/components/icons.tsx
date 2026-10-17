import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  width: props.width ?? 20,
  height: props.height ?? 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: props.strokeWidth ?? 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const IconBolt = (p: P) => (
  <svg {...base(p)}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
);
export const IconHome = (p: P) => (
  <svg {...base(p)}><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10z" /><path d="M9 22V12h6v10" /></svg>
);
export const IconDumbbell = (p: P) => (
  <svg {...base(p)}><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></svg>
);
export const IconBowl = (p: P) => (
  <svg {...base(p)}><path d="M4 12h16a8 8 0 0 1-16 0z" /><path d="M9 8c0-2 1-3 3-4M14 8c0-1.5.5-2.5 2-3" /></svg>
);
export const IconCamera = (p: P) => (
  <svg {...base(p)}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
);
export const IconCrown = (p: P) => (
  <svg {...base(p)}><path d="m2 7 4.5 4L12 4l5.5 7L22 7l-2 12H4L2 7z" /></svg>
);
export const IconDroplet = (p: P) => (
  <svg {...base(p)}><path d="M12 2s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12z" /></svg>
);
export const IconFlame = (p: P) => (
  <svg {...base(p)}><path d="M12 2c1 4-4 5.5-4 10a4 4 0 0 0 8 0c0-1.5-.5-2.5-1-3.5-1.5 1-2 2-2 3.5" /><path d="M12 22a7 7 0 0 0 7-7c0-2-1-4-2.5-5.5C15 8 13 5.5 12 2z" /></svg>
);
export const IconSparkles = (p: P) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconPlay = (p: P) => (
  <svg {...base(p)}><path d="M6 4.5v15l13-7.5-13-7.5z" /></svg>
);
export const IconPause = (p: P) => (
  <svg {...base(p)}><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" /></svg>
);
export const IconStop = (p: P) => (
  <svg {...base(p)}><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="m4.5 12.5 5 5 10-11" /></svg>
);
export const IconX = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconEyeOff = (p: P) => (
  <svg {...base(p)}><path d="M17.94 17.94A10.6 10.6 0 0 1 12 19c-6.5 0-10-7-10-7a17.6 17.6 0 0 1 5.06-5.94M9.9 4.24A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.16 3.19" /><path d="m2 2 20 20M9.88 9.88a3 3 0 1 0 4.24 4.24" /></svg>
);
export const IconLogout = (p: P) => (
  <svg {...base(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
);
export const IconEdit = (p: P) => (
  <svg {...base(p)}><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}><path d="M12 2 4 5.5v5.6c0 5 3.4 9.2 8 10.9 4.6-1.7 8-5.9 8-10.9V5.5L12 2z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
);
export const IconScan = (p: P) => (
  <svg {...base(p)}><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M3 12h18" /></svg>
);
export const IconMic = (p: P) => (
  <svg {...base(p)}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" /></svg>
);
export const IconChevronRight = (p: P) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconTrophy = (p: P) => (
  <svg {...base(p)}><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4z" /><path d="M7 6H4a1 1 0 0 0-1 1c0 2.5 1.5 4.5 4 5M17 6h3a1 1 0 0 1 1 1c0 2.5-1.5 4.5-4 5" /></svg>
);
export const IconUsers = (p: P) => (
  <svg {...base(p)}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
export const IconUserPlus = (p: P) => (
  <svg {...base(p)}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></svg>
);
export const IconMedal = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="15" r="6" /><path d="M12 12.5 13.2 15l2.6.2-2 1.7.6 2.6L12 17.8 9.6 19.5l.6-2.6-2-1.7 2.6-.2L12 12.5zM8.2 9.5 5 2h5l2 4 2-4h5l-3.2 7.5" /></svg>
);
export const IconBan = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>
);
export const IconRefresh = (p: P) => (
  <svg {...base(p)}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" /></svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" /></svg>
);
export const IconTarget = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
);
export const IconAlert = (p: P) => (
  <svg {...base(p)}><path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
);
export const IconInfo = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const IconGoogle = (p: P) => (
  <svg width={p.width ?? 18} height={p.height ?? 18} viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.2-7-5.1l-3.9 3C3.2 21.3 7.3 24 12 24z" />
    <path fill="#FBBC05" d="M5 14.3a7.4 7.4 0 0 1 0-4.6l-3.9-3a12 12 0 0 0 0 10.6l3.9-3z" />
    <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4l3.3-3.2C17 1 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.7l3.9 3c1-2.9 3.8-5.1 7-5.1z" />
  </svg>
);
