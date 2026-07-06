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
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [watchModal,    setWatchModal]    = useState(false);
  const [alarmRunning,  setAlarmRunning]  = useState(false);

  type AlarmData = { running: boolean; started_at: string | null; interval_min: number; focus_min: number; challenge_status: string | null; challenge_cycle: number; };
  const [alarmData,      setAlarmData]      = useState<AlarmData>({ running: false, started_at: null, interval_min: 15, focus_min: 2, challenge_status: null, challenge_cycle: -1 });
  const [alarmPopupOpen, setAlarmPopupOpen] = useState(false);
  const [challengeAlert,    setChallengeAlert]    = useState(false);
  const [focusWindowAlert,  setFocusWindowAlert]  = useState(false);
  const [, forceCountdown] = useState(0);
  const dropdownRef    = useRef<HTMLDivElement>(null);
  const alarmDataRef   = useRef(alarmData);

  // Keep ref in sync so the 1s ticker closure always reads the latest alarmData
  useEffect(() => { alarmDataRef.current = alarmData; }, [alarmData]);

  type DeviceRecord = { deviceId: string; deviceName: string; registeredAt: string; dropped: boolean };
  const [devices,      setDevices]      = useState<DeviceRecord[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [droppingId,   setDroppingId]   = useState<string | null>(null);

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

  /* Fetch connected devices whenever the modal opens */
  useEffect(() => {
    if (!watchModal || !authed) return;
    setDevicesLoading(true);
    fetch("/api/watch/devices")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: DeviceRecord[]) => { setDevices(data); setDevicesLoading(false); })
      .catch(() => setDevicesLoading(false));
  }, [watchModal, authed]);

  async function handleDropDevice(deviceId: string) {
    setDroppingId(deviceId);
    try {
      const res = await fetch(`/api/watch/devices/${deviceId}`, { method: "DELETE" });
      if (res.ok) setDevices(prev => prev.filter(d => d.deviceId !== deviceId));
    } finally { setDroppingId(null); }
  }

  /* Alarm running state — lightweight poll (only when authed, tab visible) */
  useEffect(() => {
    if (!authed) { setAlarmRunning(false); return; }
    let active = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(tick, ms);
    };

    const tick = async () => {
      if (!active || document.visibilityState === "hidden") { schedule(30_000); return; }
      try {
        const res = await fetch("/api/session/alarm");
        if (!active) return;
        if (res.ok) {
          const data = await res.json() as AlarmData;
          setAlarmRunning(!!data.running);
          setAlarmData({ running: !!data.running, started_at: data.started_at ?? null, interval_min: data.interval_min ?? 15, focus_min: data.focus_min ?? 2, challenge_status: data.challenge_status ?? null, challenge_cycle: data.challenge_cycle ?? -1 });
          setChallengeAlert(!!(data.running && data.challenge_status === "pending"));
          // Detect focus window: same math as the service loop
          let inFocus = false;
          if (data.running && data.started_at && (data.interval_min ?? 0) > 0) {
            const elapsed = Date.now() - new Date(data.started_at).getTime();
            const intervalMs = (data.interval_min ?? 15) * 60_000;
            const focusMs    = (data.focus_min   ??  2) * 60_000;
            inFocus = (elapsed % intervalMs) >= (intervalMs - focusMs);
          }
          setFocusWindowAlert(inFocus);
          schedule(data.running ? 8_000 : 30_000);
        } else {
          schedule(30_000);
        }
      } catch { schedule(30_000); }
    };

    const onVisible = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVisible);
    void tick();
    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authed]);

  /* Dismiss alerts when user navigates to /session */
  useEffect(() => {
    if (pathname === "/session") {
      setChallengeAlert(false);
      setFocusWindowAlert(false);
    }
  }, [pathname]);

  /* Tick every second to keep countdown live and detect focus-window transitions in real time */
  useEffect(() => {
    if (!alarmPopupOpen && !challengeAlert && !alarmRunning) return;
    const id = setInterval(() => {
      forceCountdown(n => n + 1);
      if (alarmRunning) {
        const d = alarmDataRef.current;
        if (d.started_at && d.interval_min > 0) {
          const elapsed    = Date.now() - new Date(d.started_at).getTime();
          const intervalMs = d.interval_min * 60_000;
          const focusMs    = (d.focus_min ?? 2) * 60_000;
          setFocusWindowAlert((elapsed % intervalMs) >= (intervalMs - focusMs));
        }
      }
    }, 1_000);
    return () => clearInterval(id);
  }, [alarmPopupOpen, challengeAlert, alarmRunning]);

  function computeAlarmTimer() {
    const { started_at, interval_min, focus_min } = alarmData;
    const fallback = { countdown: "—", inFocus: false, cycle: 0, intervalMin: interval_min ?? 15, focusMin: focus_min ?? 2 };
    if (!started_at || !interval_min) return fallback;
    const elapsed = Date.now() - new Date(started_at).getTime();
    const intervalMs = interval_min * 60_000;
    if (intervalMs <= 0) return fallback;
    const posInCycle = elapsed % intervalMs;
    const focusMs = (focus_min ?? 2) * 60_000;
    const inFocus = posInCycle >= (intervalMs - focusMs);
    const remaining = intervalMs - posInCycle;
    const m = Math.floor(remaining / 60_000);
    const s = Math.floor((remaining / 1_000) % 60);
    return { countdown: `${m}:${String(s).padStart(2, "0")}`, inFocus, cycle: Math.floor(elapsed / intervalMs) + 1, intervalMin: interval_min, focusMin: focus_min ?? 2 };
  }

  return (
    <>
      <style>{`
        @keyframes navAlarmPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(0,204,122,0.55), 0 0 0 0 rgba(0,204,122,0.2); opacity: 1; }
          60%      { box-shadow: 0 0 0 5px rgba(0,204,122,0),  0 0 0 9px rgba(0,204,122,0); opacity: 0.75; }
        }
        @keyframes popupIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes bannerSlideDown {
          from { opacity: 0; transform: translateY(-100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── Desktop CTAs ──────────────────────────── */}
          <div className="nav-desktop" style={{ alignItems: "center", gap: 10, flexShrink: 0 }}>
            {authed && alarmRunning && (
              <button
                title="View alarm timer"
                onClick={() => setAlarmPopupOpen(true)}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(0,204,122,0.12)",
                  border: "1px solid rgba(0,204,122,0.3)",
                  color: "var(--green)",
                  animation: "navAlarmPulse 2s ease-in-out infinite",
                  cursor: "pointer", padding: 0, flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 36 36" fill="none" aria-hidden>
                  <path d="M18 3.5V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M9.5 14.5C9.5 10.358 13.358 7 18 7C22.642 7 26.5 10.358 26.5 14.5V22.5L29 25.5H7L9.5 22.5V14.5Z"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    fill="rgba(0,204,122,0.12)"/>
                  <path d="M14.5 25.5C14.5 27.985 16.015 29.5 18 29.5C19.985 29.5 21.5 27.985 21.5 25.5"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            )}
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
                    <button
                      onClick={() => { setDropdownOpen(false); window.dispatchEvent(new CustomEvent("open-calculator")); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 9, width: "100%",
                        padding: "9px 12px", borderRadius: 5,
                        color: "var(--ink-1)", background: "none", border: "none",
                        cursor: "pointer", fontSize: 12, fontWeight: 500,
                        textAlign: "left", transition: "background 0.12s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--raised)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="12" height="12" rx="1.5"/>
                        <line x1="5" y1="5" x2="6" y2="5"/><line x1="8" y1="5" x2="9" y2="5"/><line x1="11" y1="5" x2="11" y2="5"/>
                        <line x1="5" y1="8" x2="6" y2="8"/><line x1="8" y1="8" x2="9" y2="8"/><line x1="11" y1="8" x2="11" y2="8"/>
                        <line x1="5" y1="11" x2="6" y2="11"/><line x1="8" y1="11" x2="9" y2="11"/><line x1="11" y1="11" x2="11" y2="11"/>
                      </svg>
                      Calculator
                      <span style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>Ctrl+`</span>
                    </button>
                    <button
                      onClick={() => { setDropdownOpen(false); setWatchModal(true); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 9, width: "100%",
                        padding: "9px 12px", borderRadius: 5,
                        color: "var(--ink-1)", background: "none", border: "none",
                        cursor: "pointer", fontSize: 12, fontWeight: 500,
                        textAlign: "left", transition: "background 0.12s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--raised)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="1" width="6" height="14" rx="1.5"/>
                        <line x1="5" y1="4" x2="11" y2="4"/>
                        <line x1="5" y1="12" x2="11" y2="12"/>
                        <circle cx="8" cy="13.2" r="0.6" fill="currentColor" stroke="none"/>
                      </svg>
                      Connected Devices
                    </button>
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
          <div className="nav-hamburger" style={{ alignItems: "center", gap: 6, marginRight: -8 }}>
            {alarmRunning && (
              <button
                title="View alarm timer"
                onClick={() => setAlarmPopupOpen(true)}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(0,204,122,0.12)",
                  border: "1px solid rgba(0,204,122,0.3)",
                  color: "var(--green)",
                  animation: "navAlarmPulse 2s ease-in-out infinite",
                  flexShrink: 0, cursor: "pointer", padding: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 36 36" fill="none" aria-hidden>
                  <path d="M18 3.5V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M9.5 14.5C9.5 10.358 13.358 7 18 7C22.642 7 26.5 10.358 26.5 14.5V22.5L29 25.5H7L9.5 22.5V14.5Z"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    fill="rgba(0,204,122,0.12)"/>
                  <path d="M14.5 25.5C14.5 27.985 16.015 29.5 18 29.5C19.985 29.5 21.5 27.985 21.5 25.5"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label={drawerOpen ? "Close menu" : "Open menu"}
              aria-expanded={drawerOpen}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 8, display: "flex", flexDirection: "column", gap: 5 }}
            >
              <span style={{ display: "block", width: 20, height: 1.5, background: "var(--ink-1)", transition: "transform 0.22s ease, opacity 0.22s ease", transform: drawerOpen ? "translateY(6.5px) rotate(45deg)" : "none" }}/>
              <span style={{ display: "block", width: 20, height: 1.5, background: "var(--ink-1)", transition: "opacity 0.22s ease", opacity: drawerOpen ? 0 : 1 }}/>
              <span style={{ display: "block", height: 1.5, background: "var(--ink-2)", transition: "transform 0.22s ease, opacity 0.22s ease, width 0.22s ease", transform: drawerOpen ? "translateY(-6.5px) rotate(-45deg)" : "none", width: drawerOpen ? 20 : 14 }}/>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Focus window / challenge alert banner ────────── */}
      {(focusWindowAlert || challengeAlert) && pathname !== "/session" && (
        <div style={{
          position: "fixed", top: "var(--nav-h)", left: 0, right: 0, zIndex: 150,
          background: "rgba(4,8,15,0.95)", backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(0,204,122,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "9px 16px", flexWrap: "wrap" as const,
          animation: "bannerSlideDown 0.22s cubic-bezier(0.4,0,0.2,1) both",
        }}>
          <svg width="11" height="11" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
            <path d="M18 3.5V6" stroke="#00CC7A" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M9.5 14.5C9.5 10.358 13.358 7 18 7C22.642 7 26.5 10.358 26.5 14.5V22.5L29 25.5H7L9.5 22.5V14.5Z" stroke="#00CC7A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="rgba(0,204,122,0.12)"/>
            <path d="M14.5 25.5C14.5 27.985 16.015 29.5 18 29.5C19.985 29.5 21.5 27.985 21.5 25.5" stroke="#00CC7A" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 11.5, color: "var(--green)", fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
            {focusWindowAlert ? "Focus window active" : "Focus challenge ready"}
          </span>
          {challengeAlert && focusWindowAlert && (
            <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>· challenge ready</span>
          )}
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>—</span>
          <Link
            href="/session"
            onClick={() => { setChallengeAlert(false); setFocusWindowAlert(false); }}
            style={{ fontSize: 11.5, color: "var(--green)", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Go to Session
          </Link>
          <button
            onClick={() => { setChallengeAlert(false); setFocusWindowAlert(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", padding: "2px 4px", lineHeight: 1, marginLeft: 4 }}
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg>
          </button>
        </div>
      )}

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
                <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 13 }} onClick={() => { setDrawerOpen(false); setWatchModal(true); }}>
                  Add Watch
                </button>
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

      {/* ── Alarm timer popup ────────────────────────────── */}
      {alarmPopupOpen && (() => {
        const timer = computeAlarmTimer();
        return (
          <div
            onClick={() => setAlarmPopupOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: "rgba(4,8,15,0.98)", border: "1px solid rgba(0,204,122,0.2)", borderRadius: 12, padding: "28px 28px 24px", maxWidth: 360, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.7)", animation: "popupIn 0.2s cubic-bezier(0.4,0,0.2,1) both", willChange: "transform, opacity" }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "rgba(0,204,122,0.1)", border: "1px solid rgba(0,204,122,0.25)" }}>
                    <svg width="15" height="15" viewBox="0 0 36 36" fill="none">
                      <path d="M18 3.5V6" stroke="#00CC7A" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M9.5 14.5C9.5 10.358 13.358 7 18 7C22.642 7 26.5 10.358 26.5 14.5V22.5L29 25.5H7L9.5 22.5V14.5Z" stroke="#00CC7A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="rgba(0,204,122,0.12)"/>
                      <path d="M14.5 25.5C14.5 27.985 16.015 29.5 18 29.5C19.985 29.5 21.5 27.985 21.5 25.5" stroke="#00CC7A" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-0)" }}>Focus Alarm</div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>XTNL Sovereign Trust</div>
                  </div>
                </div>
                <button onClick={() => setAlarmPopupOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4, lineHeight: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg>
                </button>
              </div>

              {/* Countdown */}
              <div style={{ textAlign: "center", padding: "18px 0 22px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: timer.inFocus ? "var(--green)" : "var(--ink-4)", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 10 }}>
                  {timer.inFocus ? "Focus Window Active" : "Next Focus Window"}
                </div>
                <div style={{ fontSize: 46, fontWeight: 800, color: timer.inFocus ? "var(--green)" : "var(--ink-0)", fontFamily: "var(--font-mono)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {timer.countdown}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 8 }}>
                  {timer.inFocus ? "focus window running" : "until focus window"}
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: "flex", justifyContent: "space-around", padding: "14px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)", marginBottom: 20 }}>
                {([
                  ["Interval", `${timer.intervalMin}m`],
                  ["Focus", `${timer.focusMin}m`],
                  ["Cycle", `#${timer.cycle}`],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9.5, color: "var(--ink-4)", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)", fontFamily: "var(--font-mono)" }}>{val}</div>
                  </div>
                ))}
              </div>

              <Link
                href="/session"
                onClick={() => setAlarmPopupOpen(false)}
                style={{ display: "block", textAlign: "center", padding: "10px", borderRadius: 7, background: "rgba(0,204,122,0.1)", border: "1px solid rgba(0,204,122,0.25)", color: "#00CC7A", fontSize: 12, fontWeight: 600, textDecoration: "none", letterSpacing: "0.04em" }}
              >
                Go to Session
              </Link>
            </div>
          </div>
        );
      })()}

      {/* ── Connected Devices modal ───────────────────────────────── */}
      {watchModal && (
        <div
          onClick={() => setWatchModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "rgba(4,8,15,0.98)", border: "1px solid rgba(0,204,122,0.2)",
              borderRadius: 12, padding: "28px 28px 24px",
              maxWidth: 420, width: "100%",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
              maxHeight: "85vh", overflowY: "auto",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(0,204,122,0.1)", border: "1px solid rgba(0,204,122,0.25)",
                }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#00CC7A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="1" width="6" height="14" rx="1.5"/>
                    <line x1="5" y1="4" x2="11" y2="4"/>
                    <line x1="5" y1="12" x2="11" y2="12"/>
                    <circle cx="8" cy="13.2" r="0.6" fill="#00CC7A" stroke="none"/>
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-0)", letterSpacing: "0.01em" }}>Connected Devices</div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>XTNL Sovereign Trust — Wear OS</div>
                </div>
              </div>
              <button
                onClick={() => setWatchModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4, lineHeight: 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
                </svg>
              </button>
            </div>

            {/* ── Connected watches list ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Active watches
              </div>
              {devicesLoading ? (
                <div style={{ fontSize: 11, color: "var(--ink-4)", padding: "12px 0" }}>Loading…</div>
              ) : devices.length === 0 ? (
                <div style={{
                  padding: "14px 16px", borderRadius: 8,
                  background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)",
                  fontSize: 11, color: "var(--ink-4)",
                }}>
                  No watches connected to this session.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {devices.map(d => (
                    <div key={d.deviceId} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", borderRadius: 8,
                      background: "rgba(0,204,122,0.04)", border: "1px solid rgba(0,204,122,0.15)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#00CC7A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="1" width="6" height="14" rx="1.5"/>
                          <line x1="5" y1="4" x2="11" y2="4"/>
                          <line x1="5" y1="12" x2="11" y2="12"/>
                          <circle cx="8" cy="13.2" r="0.6" fill="#00CC7A" stroke="none"/>
                        </svg>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-1)" }}>{d.deviceName}</div>
                          <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 1 }}>
                            Since {new Date(d.registeredAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDropDevice(d.deviceId)}
                        disabled={droppingId === d.deviceId}
                        style={{
                          padding: "5px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                          background: droppingId === d.deviceId ? "rgba(255,80,80,0.06)" : "rgba(255,80,80,0.1)",
                          border: "1px solid rgba(255,80,80,0.25)",
                          color: "var(--red)", cursor: droppingId === d.deviceId ? "not-allowed" : "pointer",
                          opacity: droppingId === d.deviceId ? 0.6 : 1,
                          transition: "opacity 0.15s",
                        }}
                      >
                        {droppingId === d.deviceId ? "…" : "Disconnect"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Add new watch section ── */}
            <div style={{ paddingTop: 18, borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                Connect a new watch
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {([
                  ["Install the app", "Build and install the XTNL watch app via Android Studio onto your Galaxy Watch."],
                  ["Open XTNL on watch", "Launch the app — you'll see the XTNL Sovereign Trust screen."],
                  ["Tap CONNECT", "The watch requests a pairing code and displays a QR code."],
                  ["Scan with your phone", "Use the camera app to scan the QR — it opens this website automatically."],
                  ["Tap Authorize Watch", "Confirm on the page that opens. The watch links instantly."],
                ] as [string, string][]).map(([title, desc], i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{
                      flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
                      background: "rgba(0,204,122,0.08)", border: "1px solid rgba(0,204,122,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, color: "#00CC7A",
                      fontFamily: "var(--font-mono)", marginTop: 1,
                    }}>
                      {i + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-2)", marginBottom: 2 }}>{title}</div>
                      <div style={{ fontSize: 10, color: "var(--ink-3)", lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => setWatchModal(false)}
                style={{
                  width: "100%", padding: "10px", borderRadius: 7,
                  background: "rgba(0,204,122,0.1)", border: "1px solid rgba(0,204,122,0.25)",
                  color: "#00CC7A", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  letterSpacing: "0.04em",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
