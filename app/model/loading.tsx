import { Skeleton, SkeletonChart } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="site-container" style={{ paddingTop: 48, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Skeleton height={10} width="20%" style={{ marginBottom: 14 }} />
        <Skeleton height={40} width="55%" style={{ marginBottom: 14 }} />
        <Skeleton height={15} width="85%" style={{ marginBottom: 6 }} />
        <Skeleton height={15} width="70%" />
      </div>

      {/* Info cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 10,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton height={20} width="60%" radius={3} />
            <Skeleton height={12} width="90%" />
            <Skeleton height={12} width="75%" />
          </div>
        ))}
      </div>

      {/* Main simulator skeleton */}
      <div className="card" style={{ overflow: "hidden" }}>
        {/* Formula strip */}
        <div style={{ padding: "10px 20px", background: "#060d16", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Skeleton height={9} width="45%" style={{ marginBottom: 8 }} />
          <Skeleton height={16} width="70%" />
        </div>

        {/* Presets */}
        <div style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={28} width="90px" radius={5} />
          ))}
        </div>

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
              <div>
                <Skeleton height={11} width="220px" style={{ marginBottom: 6 }} />
                <Skeleton height={9} width="160px" />
              </div>
              <Skeleton height={34} width="90px" radius={5} />
            </div>
            <Skeleton height={280} radius={6} />
            <Skeleton height={180} radius={6} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
              {Array.from({ length: 13 }).map((_, i) => (
                <div key={i} className="card" style={{ padding: "12px 10px" }}>
                  <Skeleton height={9} width="75%" style={{ marginBottom: 8 }} />
                  <Skeleton height={18} width="55%" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
