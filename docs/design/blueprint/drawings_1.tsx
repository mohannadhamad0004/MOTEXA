import type { ReactNode } from "react";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Svg({ children, vb = "0 0 300 200", className = "" }: { children: ReactNode; vb?: string; className?: string | undefined }) {
  return (
    <svg viewBox={vb} className={`draw glow text-bronze-light ${className}`} {...S}>
      {children}
    </svg>
  );
}

export function CarTop({ className }: { className?: string | undefined }) {
  return (
    <Svg vb="0 0 320 160" className={className}>
      <path d="M40 80 C40 50 60 38 100 36 L220 36 C262 38 285 52 288 80 C285 108 262 122 220 124 L100 124 C60 122 40 110 40 80 Z" />
      <path d="M110 44 L200 44 C215 50 222 64 222 80 C222 96 215 110 200 116 L110 116 C100 108 96 95 96 80 C96 65 100 52 110 44Z" />
      <path d="M222 54 L250 60 C258 70 258 90 250 100 L222 106" />
      <path d="M96 52 L72 58 C66 70 66 90 72 102 L96 108" />
      <path d="M130 44 L130 116 M190 44 L190 116" strokeDasharray="3 5" />
      <rect x="66" y="26" width="34" height="10" rx="4" />
      <rect x="66" y="124" width="34" height="10" rx="4" />
      <rect x="218" y="26" width="34" height="10" rx="4" />
      <rect x="218" y="124" width="34" height="10" rx="4" />
      <path d="M280 66 L288 70 M280 94 L288 90 M46 64 L42 70 M46 96 L42 90" />
      <path d="M20 80 L300 80" strokeDasharray="2 6" opacity="0.5" />
    </Svg>
  );
}

export function TowTruck({ className }: { className?: string | undefined }) {
  return (
    <Svg vb="0 0 300 140" className={className}>
      <path d="M20 100 L20 70 L60 70 L72 46 L110 46 L110 100" />
      <path d="M76 52 L104 52 L104 70 L68 70 Z" />
      <path d="M110 86 L270 86 L270 100 L110 100" />
      <path d="M150 86 L240 40 M240 40 L250 44 L250 60" />
      <path d="M250 60 C250 70 240 70 240 64" />
      <circle cx="56" cy="104" r="14" /><circle cx="56" cy="104" r="5" />
      <circle cx="200" cy="104" r="14" /><circle cx="200" cy="104" r="5" />
      <circle cx="236" cy="104" r="14" /><circle cx="236" cy="104" r="5" />
      <path d="M10 118 L290 118" strokeDasharray="2 6" opacity="0.5" />
    </Svg>
  );
}

export function BrakeDisc({ className, dims = false }: { className?: string | undefined; dims?: boolean }) {
  const holes = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return <circle key={i} cx={150 + Math.cos(a) * 26} cy={100 + Math.sin(a) * 26} r="5" />;
  });
  const vents = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return <path key={i} d={`M${150 + Math.cos(a) * 58} ${100 + Math.sin(a) * 58} L${150 + Math.cos(a + 0.12) * 78} ${100 + Math.sin(a + 0.12) * 78}`} opacity="0.7" />;
  });
  return (
    <Svg className={className}>
      <circle cx="150" cy="100" r="82" />
      <circle cx="150" cy="100" r="56" />
      <circle cx="150" cy="100" r="40" />
      <circle cx="150" cy="100" r="12" />
      {holes}
      {vents}
      {dims && (
        <>
          <path d="M68 190 L232 190 M68 184 L68 196 M232 184 L232 196" />
          <path d="M260 18 L260 182 M254 18 L266 18 M254 182 L266 182" />
          <path d="M150 100 L230 30" strokeDasharray="3 4" />
        </>
      )}
    </Svg>
  );
}

export function SparkPlug({ className }: { className?: string | undefined }) {
  return (
    <Svg vb="0 0 120 200" className={className}>
      <path d="M50 10 L70 10 L70 30 L50 30 Z M46 30 L74 30 L74 70 L46 70 Z" />
      <path d="M40 70 L80 70 L80 100 L40 100 Z M44 78 L76 78 M44 92 L76 92" />
      <path d="M50 100 L50 150 L70 150 L70 100 M50 110 L70 116 M50 122 L70 128 M50 134 L70 140" />
      <path d="M58 150 L58 168 L72 168" />
    </Svg>
  );
}

export function Wrench({ className }: { className?: string | undefined }) {
  return (
    <Svg vb="0 0 300 180" className={className}>
      <path d="M70 40 C50 40 38 58 44 76 L56 70 L66 80 L60 92 C78 98 96 86 96 66 L200 150 C208 158 222 146 214 138 L110 54 C112 46 106 40 98 40" />
      <circle cx="205" cy="144" r="3" />
      <circle cx="230" cy="62" r="20" />
      <path d="M200 120 C200 96 214 86 230 86 C246 86 260 96 260 120" />
      <path d="M216 56 L244 56" strokeDasharray="2 3" />
      <path d="M20 160 L280 160" strokeDasharray="2 6" opacity="0.5" />
    </Svg>
  );
}

export function Construction() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full text-bronze-light" preserveAspectRatio="none" viewBox="0 0 390 300" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.18">
      <circle cx="320" cy="60" r="140" />
      <circle cx="320" cy="60" r="90" strokeDasharray="2 6" />
      <circle cx="40" cy="300" r="180" />
      <path d="M-20 260 L410 20 M0 300 L390 120" />
      <path d="M195 0 L195 300" strokeDasharray="4 8" />
    </svg>
  );
}

/* Small UI line icons */
type IP = { className?: string | undefined };
const I = (d: ReactNode) => ({ className = "size-5" }: IP) => (
  <svg viewBox="0 0 24 24" className={className} {...S} strokeWidth={1.6}>{d}</svg>
);
export const Icon = {
  home: I(<path d="M3 11 L12 4 L21 11 M5 10 V20 H19 V10" />),
  parts: I(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>),
  mech: I(<path d="M14 6 a4 4 0 0 0 5 5 L11 19 a2 2 0 0 1 -3 -3 Z" />),
  tow: I(<><path d="M2 16 V11 H8 L10 7 H14 V16 M14 13 H22 V16" /><circle cx="7" cy="17" r="2" /><circle cx="18" cy="17" r="2" /></>),
  user: I(<><circle cx="12" cy="8" r="4" /><path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" /></>),
  search: I(<><circle cx="11" cy="11" r="7" /><path d="M16 16 L21 21" /></>),
  shield: I(<path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z M9 12 L11 14 L15 10" />),
  check: I(<path d="M5 12 L10 17 L19 7" />),
  arrow: I(<path d="M5 12 H19 M13 6 L19 12 L13 18" />),
  back: I(<path d="M19 12 H5 M11 6 L5 12 L11 18" />),
  chev: I(<path d="M9 6 L15 12 L9 18" />),
  down: I(<path d="M6 9 L12 15 L18 9" />),
  filter: I(<path d="M4 6 H20 M7 12 H17 M10 18 H14" />),
  pin: I(<><path d="M12 21 C12 21 5 14 5 9 a7 7 0 0 1 14 0 C19 14 12 21 12 21 Z" /><circle cx="12" cy="9" r="2.5" /></>),
  spark: I(<path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z" />),
  shop: I(<path d="M4 9 L5 4 H19 L20 9 M4 9 H20 V20 H4 Z M9 20 V14 H15 V20" />),
  chat: I(<path d="M4 5 H20 V16 H9 L5 20 V16 H4 Z" />),
  globe: I(<><circle cx="12" cy="12" r="9" /><path d="M3 12 H21 M12 3 C15 7 15 17 12 21 C9 17 9 7 12 3" /></>),
  sun: I(<><circle cx="12" cy="12" r="4" /><path d="M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M5 5 L6.5 6.5 M17.5 17.5 L19 19 M5 19 L6.5 17.5 M17.5 6.5 L19 5" /></>),
  help: I(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5 a2.5 2.5 0 1 1 3.5 2.3 C12.3 12.2 12 12.8 12 13.5 M12 17 V17.2" /></>),
  car: I(<><path d="M3 15 V11 L6 6 H18 L21 11 V15 Z M3 15 V18 H6 V15 M18 15 V18 H21 V15" /><circle cx="7.5" cy="12" r="1" /><circle cx="16.5" cy="12" r="1" /></>),
  box: I(<path d="M4 8 L12 4 L20 8 V16 L12 20 L4 16 Z M4 8 L12 12 L20 8 M12 12 V20" />),
};
