/**
 * The Calendarly mark: a diary page with its brick-red ribbon marker hanging
 * out of the bottom, the same ribbon that marks the AI note on the dashboard.
 * Drawn on a 32-unit grid; colours come from the theme tokens.
 */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="5" y="4" width="22" height="23" rx="3.5" className="fill-paper stroke-ink" strokeWidth="2" />
      <path d="M5 10h22" className="stroke-ink" strokeWidth="2" />
      <path d="M11 2v4M21 2v4" className="stroke-ink" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 15h6M9 19h6M9 23h4" className="stroke-pencil" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 10h6v20l-3-2.4-3 2.4z" className="fill-ribbon" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="font-serif text-xl font-semibold tracking-tight">Calendarly</span>
    </span>
  );
}

/** The same mark as plain SVG markup with fixed colours, for icons and images outside the page. */
export function logoMarkSvg(c: { paper: string; ink: string; pencil: string; ribbon: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect x="5" y="4" width="22" height="23" rx="3.5" fill="${c.paper}" stroke="${c.ink}" stroke-width="2"/>
<path d="M5 10h22" stroke="${c.ink}" stroke-width="2"/>
<path d="M11 2v4M21 2v4" stroke="${c.ink}" stroke-width="2" stroke-linecap="round"/>
<path d="M9 15h6M9 19h6M9 23h4" stroke="${c.pencil}" stroke-width="1.6" stroke-linecap="round"/>
<path d="M18 10h6v20l-3-2.4-3 2.4z" fill="${c.ribbon}"/>
</svg>`;
}

export const BRAND = { paper: "#faf7f0", ink: "#2a2420", pencil: "#6e655c", ribbon: "#a8452b" };
