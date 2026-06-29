import Link from "next/link";

const LINKS = [
  { href: "/",           label: "Overview" },
  { href: "/prospectus", label: "Prospectus" },
  { href: "/model",      label: "Simulator" },
  { href: "/data",       label: "Data" },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", marginTop: 96 }}>
      <div className="site-container" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 32,
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 80 80" fill="none">
                <path d="M24,0 L0,0 L0,80 L24,80" stroke="var(--ink-3)" strokeWidth="5" strokeLinecap="square"/>
                <path d="M56,0 L80,0 L80,80 L56,80" stroke="var(--green)" strokeWidth="5" strokeLinecap="square"/>
                <line x1="22" y1="22" x2="58" y2="58" stroke="var(--blue)" strokeWidth="5" strokeLinecap="square"/>
                <line x1="58" y1="22" x2="22" y2="58" stroke="var(--base)" strokeWidth="9" strokeLinecap="square"/>
                <line x1="58" y1="22" x2="22" y2="58" stroke="white" strokeWidth="5" strokeLinecap="square"/>
              </svg>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: "var(--ink-0)" }}>
                XTNL SOVEREIGN TRUST
              </span>
            </div>
            <p className="label-xs" style={{ color: "var(--ink-3)", marginTop: 4 }}>
              Institutional Prospectus · Confidential
            </p>
          </div>

          {/* Nav */}
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="nav-link">
                {label}
              </Link>
            ))}
          </div>

          {/* Contact + Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <a
              href="mailto:xt@xtnl-solutions.com"
              className="mono footer-email"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--green)",
                textDecoration: "none",
                letterSpacing: "0.04em",
              }}
            >
              xt@xtnl-solutions.com
            </a>
            <p className="label-xs">EUR/USD Spot · v5.2.5 Firmware</p>
            <p className="label-xs" style={{ color: "var(--ink-3)" }}>
              Clayton South, VIC, Australia
            </p>
          </div>
        </div>

        <div style={{ marginTop: 32, borderTop: "1px solid var(--line)", paddingTop: 24 }}>
          <p style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.7 }}>
            This document is for informational purposes only. Past performance does not guarantee
            future results. Algorithmic trading involves substantial risk of capital loss.
            Projections are based on historical statistical data and are not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
