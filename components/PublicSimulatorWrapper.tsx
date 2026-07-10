"use client";

import dynamic from "next/dynamic";

const PublicSimulator = dynamic(
  () => import("@/components/PublicSimulator"),
  {
    ssr: false,
    loading: () => (
      <div style={{
        minHeight: 340, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}>
        <span style={{ fontSize: 10, color: "rgba(142,163,190,0.40)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
          LOADING SIMULATOR…
        </span>
      </div>
    ),
  }
);

export default function PublicSimulatorWrapper() {
  return <PublicSimulator />;
}
