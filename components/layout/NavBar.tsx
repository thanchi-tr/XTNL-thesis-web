"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import LoginModal from "./LoginModal";

const LINKS = [
  { href: "/",           label: "Overview",   authedOnly: false, hideWhenAuthed: false },
  { href: "/prospectus", label: "Prospectus", authedOnly: false, hideWhenAuthed: false },
  { href: "/model",      label: "Simulator",  authedOnly: false, hideWhenAuthed: true  },
  { href: "/data",       label: "Data",       authedOnly: false, hideWhenAuthed: false },
  { href: "/session",    label: "Session",    authedOnly: true,  hideWhenAuthed: false },
  { href: "/analytics",  label: "Analytics",  authedOnly: true,  hideWhenAuthed: false },
];

export default function NavBar() {
  const [scrolled,   setScrolled]   = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);

  const pathname           = usePathname();
  const { data: session }  = useSession();

  /* Auto-open 2FA modal after Microsoft OAuth callback */
  useEffect(() => {
    if (session && !session.twoFactorVerified) setModalOpen(true);
  }, [session]);

  /* Close modal once fully authenticated */
  useEffect(() => {
    if (session?.twoFactorVerified) setModalOpen(false);
  }, [session?.twoFactorVerified]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setDrawerOpen(false), [pathname]);

  /* Body scroll lock for drawer (modal manages its own) */
  useEffect(() => {
    if (!modalOpen) document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { if (!modalOpen) document.body.style.overflow = ""; };
  }, [drawerOpen, modalOpen]);

  const authed = session?.twoFactorVerified;

  return (
    <>
      <nav
        style={{
          position: "fixed", top: 0, left: 0, right: 0,
          height: "var(--nav-h)", zIndex: 100,
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
          {/* ── Logo ──────────────────────────────────── */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
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
            <span className="nav-desktop mono" style={{ fontSize: 9, letterSpacing: "0.10em", color: "var(--ink-3)", paddingLeft: 10, borderLeft: "1px solid var(--line)" }}>
              SOVEREIGN TRUST
            </span>
          </Link>

          {/* ── Desktop nav ───────────────────────────── */}
          <div className="nav-desktop" style={{ alignItems: "center", gap: 32 }}>
            {LINKS.filter(l => (!l.authedOnly || authed) && !(l.hideWhenAuthed && authed)).map(({ href, label }) => (
              <Link key={href} href={href} className={`nav-link${pathname === href ? " active" : ""}`}>
                {label}
              </Link>
            ))}
          </div>

          {/* ── Desktop CTAs ──────────────────────────── */}
          <div className="nav-desktop" style={{ alignItems: "center", gap: 10, flexShrink: 0 }}>
            {authed ? (
              <>
                {/* Authenticated user chip */}
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "var(--green-10)", border: "1px solid rgba(0,204,122,0.20)",
                    borderRadius: 5, padding: "5px 10px", maxWidth: 200,
                  }}
                >
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "var(--green)", flexShrink: 0,
                    }}
                  />
                  <span
                    className="mono"
                    style={{
                      fontSize: 10.5, color: "var(--green)", fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {session.userEmail || session.userName}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ redirectTo: "/" })}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "7px 14px" }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setModalOpen(true)}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: "7px 14px" }}
              >
                Sign In
              </button>
            )}
            <Link href="/model" className="btn btn-primary" style={{ fontSize: 11, padding: "8px 18px" }}>
              Run Simulation
            </Link>
          </div>

          {/* ── Hamburger ─────────────────────────────── */}
          <button
            className="nav-hamburger"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, flexDirection: "column", gap: 5, marginRight: -8 }}
          >
            <span style={{ display: "block", width: 20, height: 1.5, background: "var(--ink-1)", transition: "transform 0.22s ease, opacity 0.22s ease", transform: drawerOpen ? "translateY(6.5px) rotate(45deg)" : "none" }}/>
            <span style={{ display: "block", width: 20, height: 1.5, background: "var(--ink-1)", transition: "opacity 0.22s ease", opacity: drawerOpen ? 0 : 1 }}/>
            <span style={{ display: "block", height: 1.5, background: "var(--ink-2)", transition: "transform 0.22s ease, opacity 0.22s ease, width 0.22s ease", transform: drawerOpen ? "translateY(-6.5px) rotate(-45deg)" : "none", width: drawerOpen ? 20 : 14 }}/>
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer ─────────────────────────────────── */}
      <div
        aria-hidden={!drawerOpen}
        style={{
          position: "fixed", top: "var(--nav-h)", left: 0, right: 0, zIndex: 99,
          background: "rgba(4,8,15,0.97)", backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--line)",
          transform: drawerOpen ? "translateY(0)" : "translateY(-108%)",
          opacity: drawerOpen ? 1 : 0,
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
          pointerEvents: drawerOpen ? "auto" : "none",
        }}
      >
        <div className="site-container" style={{ paddingTop: 20, paddingBottom: 28 }}>
          {LINKS.filter(l => (!l.authedOnly || authed) && !(l.hideWhenAuthed && authed)).map(({ href, label }, i) => (
            <Link
              key={href} href={href} className="nav-link-mobile"
              onClick={() => setDrawerOpen(false)}
              style={{ transitionDelay: drawerOpen ? `${i * 40}ms` : "0ms", opacity: drawerOpen ? 1 : 0, transform: drawerOpen ? "none" : "translateX(-8px)", transition: "opacity 0.25s ease, transform 0.25s ease, color 0.15s" }}
            >
              {label}
            </Link>
          ))}
          <div style={{ paddingTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/model" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 13 }} onClick={() => setDrawerOpen(false)}>
              Run Simulation
            </Link>
            {authed ? (
              <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 13 }} onClick={() => { setDrawerOpen(false); signOut({ redirectTo: "/" }); }}>
                Sign Out
              </button>
            ) : (
              <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 13 }} onClick={() => { setDrawerOpen(false); setModalOpen(true); }}>
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Drawer backdrop ───────────────────────────────── */}
      <div
        onClick={() => setDrawerOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 98, background: "rgba(0,0,0,0.5)", opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? "auto" : "none", transition: "opacity 0.25s ease" }}
      />

      {/* ── Login modal ───────────────────────────────────── */}
      <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
