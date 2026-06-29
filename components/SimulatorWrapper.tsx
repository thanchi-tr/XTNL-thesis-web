"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

/* Dynamic import must live in a Client Component when ssr:false is used.
   This wrapper satisfies that requirement so the Server Component page
   (app/model/page.tsx) can import it without triggering the build error. */
const MonteCarloSimulator = dynamic(
  () => import("@/components/MonteCarloSimulator"),
  {
    ssr: false,
    loading: () => (
      <div className="card" style={{ overflow: "hidden" }}>
        {/* Formula strip */}
        <div style={{ padding: "10px 20px", background: "#060d16", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Skeleton height={9}  width="50%" style={{ marginBottom: 8 }} />
          <Skeleton height={16} width="72%" />
        </div>
        {/* Presets */}
        <div style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
          {[80, 80, 80].map((_, i) => <Skeleton key={i} height={28} width="80px" radius={5} />)}
        </div>
        {/* Body */}
        <div style={{ display: "flex" }}>
          {/* Controls skeleton */}
          <div style={{ width: 310, padding: 20, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 22 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Skeleton height={9} width="45%" />
                  <Skeleton height={9} width="22%" />
                </div>
                <Skeleton height={3} width="100%" radius={2} />
              </div>
            ))}
          </div>
          {/* Chart skeleton */}
          <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Skeleton height={11} width="220px" />
              <Skeleton height={34} width="80px" radius={5} />
            </div>
            <Skeleton height={280} radius={6} />
            <Skeleton height={180} radius={6} />
          </div>
        </div>
      </div>
    ),
  }
);

export default function SimulatorWrapper() {
  return <MonteCarloSimulator />;
}
