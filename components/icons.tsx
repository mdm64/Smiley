type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const Loop = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5m-4 9a8 8 0 0 0 14 2l3-3m0 5v-5h-5" />
  </svg>
);
export const Home = ({ size = 19, className }: P) => (
  <svg {...base(size)} className={className}><path d="m3 10 9-7 9 7v10H6V10m3 10v-7h6v7" /></svg>
);
export const Compass = ({ size = 19, className }: P) => (
  <svg {...base(size)} className={className}><path d="m20 4-5 11-11 5L9 9Zm-11 5 6 6" /></svg>
);
export const Heart = ({ size = 19, className, filled }: P & { filled?: boolean }) => (
  <svg {...base(size)} className={className} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20S2 14 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 12-10 12Z" />
  </svg>
);
export const Chat = ({ size = 19, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 4h16v12H9l-5 4Z" /></svg>
);
export const User = ({ size = 19, className }: P) => (
  <svg {...base(size)} className={className}><path d="M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0m-4 14a8 8 0 0 1 16 0" /></svg>
);
export const Plus = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const Search = ({ size = 17, className }: P) => (
  <svg {...base(size)} className={className}><path d="m16 16 5 5M3 10a7 7 0 1 0 14 0 7 7 0 1 0-14 0" /></svg>
);
export const Pin = ({ size = 13, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 22s7-8 7-14a7 7 0 0 0-14 0c0 6 7 14 7 14Zm-3-14a3 3 0 1 0 6 0 3 3 0 1 0-6 0" /></svg>
);
export const Send = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 12h16m-5-5 5 5-5 5" /></svg>
);
export const Shield = ({ size = 19, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6Zm-3 10 2 2 4-4" /></svg>
);
export const Back = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}><path d="M20 12H4m5 5-5-5 5-5" /></svg>
);
export const Image = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 5h18v14H3Zm0 10 5-4 4 3 3-3 6 5" /><circle cx="8.5" cy="9" r="1.4" />
  </svg>
);
