interface XtnlLogoProps {
  width?:  number | string;
  height?: number | string;
  style?:  React.CSSProperties;
}

export default function XtnlLogo({ width = 20, height = 20, style }: XtnlLogoProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 80 80" fill="none" aria-hidden style={style}>
      {/* lower diamond sides — very dim */}
      <line x1="63" y1="52" x2="40" y2="74" stroke="rgba(0,204,122,0.09)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="17" y1="52" x2="40" y2="74" stroke="rgba(0,204,122,0.09)" strokeWidth="1.5" strokeLinecap="round"/>
      {/* upper diamond sides — structural base */}
      <line x1="40" y1="29" x2="63" y2="52" stroke="rgba(0,204,122,0.15)" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="40" y1="29" x2="17" y2="52" stroke="rgba(0,204,122,0.15)" strokeWidth="1.3" strokeLinecap="round"/>
      {/* upper half ambient fill */}
      <polygon points="40,29 63,52 17,52" fill="rgba(0,204,122,0.03)"/>
      {/* threshold dashed midline */}
      <line x1="17" y1="52" x2="63" y2="52" stroke="rgba(0,204,122,0.22)" strokeWidth="1" strokeDasharray="4 3"/>
      {/* bottom vertex — hollow ring */}
      <circle cx="40" cy="74" r="3"   fill="none" stroke="rgba(0,204,122,0.22)" strokeWidth="1"/>
      {/* left vertex — dim node */}
      <circle cx="17" cy="52" r="1.8" fill="rgba(0,204,122,0.22)"/>
      {/* right vertex — blue accent */}
      <circle cx="63" cy="52" r="3.2" fill="none" stroke="rgba(0,180,255,0.45)" strokeWidth="1"/>
      <circle cx="63" cy="52" r="1.8" fill="#00b4ff" opacity="0.7"/>
      {/* crossing lines from nodes to opposite vertices — form the X above the diamond */}
      <line x1="27" y1="8"  x2="63" y2="52" stroke="rgba(0,204,122,0.52)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="51" y1="13" x2="17" y2="52" stroke="rgba(0,204,122,0.28)" strokeWidth="1.5" strokeLinecap="round"/>
      {/* node A — left partner, slightly higher */}
      <circle cx="27" cy="8"  r="5"   fill="rgba(0,204,122,0.7)"  style={{ filter: "drop-shadow(0 0 4px #00cc7a)" }}/>
      <circle cx="27" cy="8"  r="2.8" fill="#b0ffe0"/>
      {/* node B — right partner */}
      <circle cx="51" cy="13" r="4.5" fill="rgba(0,204,122,0.65)" style={{ filter: "drop-shadow(0 0 3px #00cc7a)" }}/>
      <circle cx="51" cy="13" r="2.2" fill="#b0ffe0"/>
    </svg>
  );
}
