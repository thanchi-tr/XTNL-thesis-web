"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/",           label: "Overview"    },
  { href: "/prospectus", label: "Prospectus"  },
  { href: "/model",      label: "Simulator"   },
  { href: "/data",       label: "Data"        },
];

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [open,     setOpen]     = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          height: "var(--nav-h)",
          zIndex: 100,
          background: scrolled ? "rgba(4,8,15,0.90)" : "transparent",
          backdropFilter: scrolled ? "blur(16px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px) saturate(180%)" : "none",
          borderBottom: `1px solid ${scrolled ? "var(--line)" : "transparent"}`,
          transition: "background 0.35s ease, border-color 0.35s ease",
        }}
      >
        <div
          className="site-container"
          style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          {/* ── Logo ─────────────────────────────────────── */}
          <Link
            href="/"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              textDecoration: "none", flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 80 80" fill="none" aria-hidden>
              <path d="M24,0 L0,0 L0,80 L24,80"  stroke="var(--ink-3)" strokeWidth="5" strokeLinecap="square"/>
              <path d="M56,0 L80,0 L80,80 L56,80" stroke="var(--green)" strokeWidth="5" strokeLinecap="square"/>
              <line x1="22" y1="22" x2="58" y2="58" stroke="var(--blue)"  strokeWidth="5" strokeLinecap="square"/>
              <line x1="58" y1="22" x2="22" y2="58" stroke="var(--base)"  strokeWidth="9" strokeLinecap="square"/>
              <line x1="58" y1="22" x2="22" y2="58" stroke="white"        strokeWidth="5" strokeLinecap="square"/>
            </svg>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "var(--ink-0)" }}>
              XTNL
            </span>
            {/* Subtitle — visible only on wider nav-desktop screens */}
            <span
              className="nav-desktop mono"
              style={{
                fontSize: 9, letterSpacing: "0.10em", color: "var(--ink-3)",
                paddingLeft: 10, borderLeft: "1px solid var(--line)",
              }}
            >
              SOVEREIGN TRUST
            </span>
          </Link>

          {/* ── Desktop links — uses .nav-desktop CSS class ── */}
          <div className="nav-desktop" style={{ alignItems: "center", gap: 32 }}>
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link${pathname === href ? " active" : ""}`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── Desktop CTA ───────────────────────────────── */}
          <div className="nav-desktop" style={{ alignItems: "center", gap: 12, flexShrink: 0 }}>
            <Link href="/model" className="btn btn-primary" style={{ fontSize: 11, padding: "8px 18px" }}>
              Run Simulation
            </Link>
          </div>

          {/* ── Hamburger — uses .nav-hamburger CSS class ─── */}
          <button
            className="nav-hamburger"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 8, flexDirection: "column", gap: 5, marginRight: -8,
            }}
          >
            {/* Three bars morphing to X */}
            <span style={{
              display: "block", width: 20, height: 1.5,
              background: "var(--ink-1)",
              transition: "transform 0.22s ease, opacity 0.22s ease",
              transform: open ? "translateY(6.5px) rotate(45deg)" : "none",
            }}/>
            <span style={{
              display: "block", width: 20, height: 1.5,
              background: "var(--ink-1)",
              transition: "opacity 0.22s ease",
              opacity: open ? 0 : 1,
            }}/>
            <span style={{
              display: "block", width: 14, height: 1.5,
              background: "var(--ink-2)",
              transition: "transform 0.22s ease, opacity 0.22s ease",
              transform: open ? "translateY(-6.5px) rotate(-45deg)" : "none",
              width: open ? 20 : 14,
            }}/>
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer ──────────────────────────────────── */}
      <div
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: "var(--nav-h)", left: 0, right: 0,
          zIndex: 99,
          background: "rgba(4,8,15,0.97)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--line)",
          transform: open ? "translateY(0)" : "translateY(-108%)",
          opacity: open ? 1 : 0,
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="site-container" style={{ paddingTop: 20, paddingBottom: 28 }}>
          {LINKS.map(({ href, label }, i) => (
            <Link
              key={href}
              href={href}
              className="nav-link-mobile"
              onClick={() => setOpen(false)}
              style={{
                transitionDelay: open ? `${i * 40}ms` : "0ms",
                opacity: open ? 1 : 0,
                transform: open ? "none" : "translateX(-8px)",
                transition: "opacity 0.25s ease, transform 0.25s ease, color 0.15s",
              }}
            >
              {label}
            </Link>
          ))}
          <div style={{ paddingTop: 20 }}>
            <Link
              href="/model"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", fontSize: 13 }}
              onClick={() => setOpen(false)}
            >
              Run Simulation
            </Link>
          </div>
        </div>
      </div>

      {/* ── Overlay ────────────────────────────────────────── */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 98,
          background: "rgba(0,0,0,0.5)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />
    </>
  );
}
