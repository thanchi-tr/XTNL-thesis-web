"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import LoginModal from "./LoginModal";
import XtnlLogo from "@/components/ui/XtnlLogo";

const LINKS = [
  { href: "/",           label: "Overview",   authedOnly: false, hideWhenAuthed: false },
  { href: "/prospectus", label: "Prospectus", authedOnly: false, hideWhenAuthed: false },
  { href: "/model",      label: "Simulator",  authedOnly: false, hideWhenAuthed: true  },
  { href: "/data",       label: "Data",       authedOnly: true,  hideWhenAuthed: false },
  { href: "/session",    label: "Session",    authedOnly: true,  hideWhenAuthed: false },
  { href: "/analytics",  label: "Analytics",  authedOnly: true,  hideWhenAuthed: false },
];

export default function NavBar() {
  const [scrolled,     setScrolled]     = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
  useEffect(() => setDropdownOpen(false), [pathname]);

  /* Close user dropdown on outside click */
  useEffect(() => {
    if (!dropdownOpen) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

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
          backdropFilter: scrolled ? "blur(18px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(18px) saturate(180%)" : "none",
          borderBottom: `1px solid ${scrolled ? "rgba(0,204,122,0.1)" : "transparent"}`,
          boxShadow: scrolled ? "0 4px 32px rgba(0,0,0,0.38)" : "none",
          transition: "background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease",
        }}
      >
        <div
          className="site-container"
          style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          {/* ── Logo ──────────────────────────────────── */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
            <XtnlLogo width="20" height="20" />
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "var(--ink-0)" }}>
              XTNL
            </span>
            <span className="nav-desktop mono" style={{ fontSize: 9, letterSpacing: "0.10em", color: "var(--ink-3)", paddingLeft: 10, borderLeft: "1px solid var(--line)" }}>
              SOLUTIONS
            </span>
          </Link>

          {/* ── Desktop nav ───────────────────────────── */}
          <div className="nav-desktop" style={{ alignItems: "center", gap: 32 }}>
            {LINKS.filter(l => (!l.authedOnly || authed) && !(l.hideWhenAuthed && authed)).map(({ href, label, authedOnly }) => (
              <Link
                key={href} href={href}
                className={`nav-link${pathname === href ? " active" : ""}${authedOnly ? " nav-link-accent" : ""}`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── Desktop CTAs ──────────────────────────── */}
          <div className="nav-desktop" style={{ alignItems: "center", gap: 10, flexShrink: 0 }}>
            {authed ? (
              /* User dropdown */
              <div ref={dropdownRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "var(--green-10)", border: "1px solid rgba(0,204,122,0.20)",
                    borderRadius: 5, padding: "5px 10px", maxWidth: 220,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--green)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session.userEmail || session.userName}
                  </span>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0, transition: "transform 0.18s", transform: dropdownOpen ? "rotate(180deg)" : "none" }}>
                    <path d="M1 2.5l3 3 3-3" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {dropdownOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
                    background: "rgba(4,8,15,0.97)", border: "1px solid var(--line-hi)",
                    borderRadius: 7, padding: "6px", minWidth: 160,
                    boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
                    backdropFilter: "blur(16px)",
                  }}>
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: "flex", alignItems: "center", gap: 9,
                        padding: "9px 12px", borderRadius: 5,
                        color: "var(--ink-1)", textDecoration: "none", fontSize: 12,
                        fontWeight: 500, letterSpacing: "0.01em",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--raised)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2.5 13.5c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      Profile
                    </Link>
                    <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
                    <button
                      onClick={() => { setDropdownOpen(false); signOut({ redirectTo: "/" }); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 9, width: "100%",
                        padding: "9px 12px", borderRadius: 5,
                        color: "var(--red)", background: "none", border: "none",
                        cursor: "pointer", fontSize: 12, fontWeight: 500,
                        textAlign: "left", transition: "background 0.12s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--red-10)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 8h7M10 5l3 3-3 3M9 3H3v10h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
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
              <>
                <Link href="/profile" className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 13 }} onClick={() => setDrawerOpen(false)}>
                  Profile
                </Link>
                <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 13, color: "var(--red)" }} onClick={() => { setDrawerOpen(false); signOut({ redirectTo: "/" }); }}>
                  Sign Out
                </button>
              </>
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
