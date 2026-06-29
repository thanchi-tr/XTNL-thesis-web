"use client";

import { useState, useEffect } from "react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        zIndex: 80,
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "var(--raised)",
        border: "1px solid var(--line-hi)",
        color: "var(--ink-1)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "var(--green)";
        el.style.borderColor = "var(--green)";
        el.style.color = "#000";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "var(--raised)";
        el.style.borderColor = "var(--line-hi)";
        el.style.color = "var(--ink-1)";
      }}
    >
      ↑
    </button>
  );
}
