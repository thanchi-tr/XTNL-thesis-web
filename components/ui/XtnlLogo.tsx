interface XtnlLogoProps {
  width?:  number | string;
  height?: number | string;
  style?:  React.CSSProperties;
}

/**
 * XTNL brand mark — twin signature nodes crossing into an "X" above a diamond
 * vessel, with a blue accent vertex (secondary brand colour). Rendered with a
 * green sheen gradient + glowing nodes so it reads boldly at any size.
 *
 * Uses a fixed gradient id: every instance is visually identical and shares the
 * same 0–80 viewBox, so browsers resolving url(#…) to the first definition is
 * harmless and correct at any rendered size.
 */
export default function XtnlLogo({ width = 20, height = 20, style }: XtnlLogoProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 80 80" fill="none" aria-hidden style={style}>
      <defs>
        <linearGradient id="xtnl-g" x1="24" y1="6" x2="58" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#3dffb0" />
          <stop offset="55%"  stopColor="#00cc7a" />
          <stop offset="100%" stopColor="#009e60" />
        </linearGradient>
        <radialGradient id="xtnl-f" cx="40" cy="42" r="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#00cc7a" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#00cc7a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* upper-triangle ambient fill */}
      <polygon points="40,29 63,52 17,52" fill="url(#xtnl-f)" />

      {/* diamond structure — present but secondary */}
      <path d="M40 29 L63 52 M40 29 L17 52" stroke="url(#xtnl-g)" strokeWidth="2.2" strokeOpacity="0.55" strokeLinecap="round" />
      <path d="M63 52 L40 74 M17 52 L40 74" stroke="#00cc7a" strokeWidth="2" strokeOpacity="0.24" strokeLinecap="round" />

      {/* threshold midline */}
      <line x1="18" y1="52" x2="62" y2="52" stroke="#00cc7a" strokeOpacity="0.34" strokeWidth="1.3" strokeDasharray="4 3" />

      {/* crossing X — the hero of the mark */}
      <line x1="27" y1="8"  x2="63" y2="52" stroke="url(#xtnl-g)" strokeWidth="3.4" strokeLinecap="round" />
      <line x1="51" y1="13" x2="17" y2="52" stroke="url(#xtnl-g)" strokeWidth="2.6" strokeOpacity="0.72" strokeLinecap="round" />

      {/* vertices */}
      <circle cx="40" cy="74" r="3.4" fill="none" stroke="#00cc7a" strokeOpacity="0.45" strokeWidth="1.3" />
      <circle cx="17" cy="52" r="2.3" fill="#00cc7a" fillOpacity="0.55" />
      {/* right vertex — blue accent (secondary brand colour) */}
      <circle cx="63" cy="52" r="3.6" fill="none" stroke="#2fd0ff" strokeOpacity="0.55" strokeWidth="1.3" />
      <circle cx="63" cy="52" r="2"   fill="#2fd0ff" />

      {/* signature nodes — bright, glowing */}
      <g style={{ filter: "drop-shadow(0 0 3px rgba(0,240,144,0.9))" }}>
        <circle cx="27" cy="8"  r="6.4" fill="#00cc7a" fillOpacity="0.30" />
        <circle cx="27" cy="8"  r="4.4" fill="#00f090" />
        <circle cx="27" cy="8"  r="2.4" fill="#e6fff4" />
        <circle cx="51" cy="13" r="5.4" fill="#00cc7a" fillOpacity="0.24" />
        <circle cx="51" cy="13" r="3.7" fill="#00e688" />
        <circle cx="51" cy="13" r="2"   fill="#e6fff4" />
      </g>
    </svg>
  );
}
