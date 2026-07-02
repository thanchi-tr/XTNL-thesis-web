import Link from "next/link";
import XtnlLogo from "@/components/ui/XtnlLogo";

const LINKS = [
  { href: "/",           label: "Overview" },
  { href: "/about",      label: "About" },
  { href: "/prospectus", label: "Prospectus" },
  { href: "/model",      label: "Simulator" },
  { href: "/data",       label: "Data" },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(0,204,122,0.1)", marginTop: 96, position: "relative" }}>
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
              <XtnlLogo width="18" height="18" />
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: "var(--ink-0)" }}>
                XTNL SOLUTIONS
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

        <div style={{ marginTop: 32, borderTop: "1px solid var(--line)", paddingTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.7 }}>
            This document is for informational purposes only. Past performance does not guarantee
            future results. Algorithmic trading involves substantial risk of capital loss.
            Projections are based on historical statistical data and are not financial advice.
          </p>
          <p className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.04em" }}>
            © {new Date().getFullYear()} XTNL Solutions · xtnl-solutions.com · All rights reserved.
          </p>
          <p className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.04em", opacity: 0.6 }}>
            ABN 96 412 697 885
          </p>
        </div>
      </div>
    </footer>
  );
}
