"use client";

import { useState, useEffect } from "react";

export interface SidebarSection {
  id: string;
  n: string;
  title: string;
  group?: string;
}

export default function ProspectusSidebar({ sections }: { sections: SidebarSection[] }) {
  const [active,  setActive]  = useState<string>(sections[0]?.id ?? "");
  const [visible, setVisible] = useState(false);

  /* ── Responsive: only show on wide desktop ─────────────── */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1180px)");
    setVisible(mq.matches);
    const h = (e: MediaQueryListEvent) => setVisible(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  /* ── Scroll-spy via IntersectionObserver ────────────────── *
   *  No getBoundingClientRect() → no layout reflow → smooth   *
   *  rootMargin carves out the nav bar + keeps only the top   *
   *  portion of the viewport as the "active" zone.            */
  useEffect(() => {
    if (!visible) return;

    // Map in document order so the first intersecting one wins
    const sectionEls = sections
      .map(({ id }) => ({ id, el: document.getElementById(id) }))
      .filter((s): s is { id: string; el: HTMLElement } => Boolean(s.el));

    const visible_ = new Set<string>();

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visible_.add(e.target.id);
          else                  visible_.delete(e.target.id);
        });
        // First section in document order that is visible
        const top = sectionEls.find(({ id }) => visible_.has(id));
        if (top) setActive(top.id);
      },
      { rootMargin: "-76px 0px -62% 0px", threshold: 0 }
    );

    sectionEls.forEach(({ el }) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections, visible]);

  if (!visible) return null;

  /* ── Group sections ─────────────────────────────────────── */
  const groups: Record<string, SidebarSection[]> = {};
  sections.forEach((s) => {
    const g = s.group ?? "—";
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  });

  return (
    <aside
      style={{
        width: 190,
        flexShrink: 0,
        position: "sticky",
        top: "calc(var(--nav-h) + 24px)",
        maxHeight: "calc(100vh - var(--nav-h) - 48px)",
        overflowY: "auto",
        scrollbarWidth: "none",
        paddingBottom: 32,
      }}
    >
      <style>{`aside::-webkit-scrollbar{display:none}`}</style>

      {Object.entries(groups).map(([group, items]) => (
        <div key={group} style={{ marginBottom: 22 }}>
          <p
            style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.18)",
              paddingLeft: 14, marginBottom: 6,
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {group}
          </p>

          {items.map(({ id, n, title }) => {
            const on = active === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "5px 14px",
                  textDecoration: "none",
                  borderRadius: 4,
                  background: on ? "rgba(0,204,122,0.07)" : "transparent",
                  position: "relative",
                  /* No transition on background — instant feel, no visual lag */
                }}
              >
                {/* Active bar */}
                {on && (
                  <span
                    style={{
                      position: "absolute", left: 0, top: "15%", bottom: "15%",
                      width: 2, borderRadius: 1, background: "var(--green)",
                    }}
                  />
                )}
                <span
                  className="mono"
                  style={{
                    fontSize: 9, fontWeight: 700, minWidth: 16, paddingTop: 1, flexShrink: 0,
                    color: on ? "var(--green)" : "rgba(255,255,255,0.2)",
                  }}
                >
                  {n}
                </span>
                <span
                  style={{
                    fontSize: 11, lineHeight: 1.35,
                    color: on ? "var(--ink-0)" : "var(--ink-2)",
                    fontWeight: on ? 500 : 400,
                  }}
                >
                  {title}
                </span>
              </a>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
