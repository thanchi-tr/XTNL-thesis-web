import { Skeleton } from "@/components/ui/Skeleton";

function Para() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
      <Skeleton height={13} width="100%" />
      <Skeleton height={13} width="95%" />
      <Skeleton height={13} width="88%" />
      <Skeleton height={13} width="72%" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="site-container" style={{ paddingTop: 48, paddingBottom: 96 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", gap: 8, marginBottom: 36 }}>
        <Skeleton height={12} width="60px" />
        <Skeleton height={12} width="8px" />
        <Skeleton height={12} width="160px" />
      </div>

      {/* Cover */}
      <div style={{ marginBottom: 40 }}>
        <Skeleton height={10} width="22%" style={{ marginBottom: 14 }} />
        <Skeleton height={48} width="65%" style={{ marginBottom: 14 }} />
        <Skeleton height={15} width="85%" style={{ marginBottom: 6 }} />
        <Skeleton height={15} width="70%" style={{ marginBottom: 28 }} />
        {/* Meta grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 1,
            borderRadius: 6,
            overflow: "hidden",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ padding: "14px 16px", background: "var(--card)" }}>
              <Skeleton height={9} width="55%" style={{ marginBottom: 8 }} />
              <Skeleton height={11} width="75%" />
            </div>
          ))}
        </div>
      </div>

      {/* Two-col layout */}
      <div style={{ display: "flex", gap: 48 }}>
        {/* Sidebar placeholder (desktop) */}
        <div style={{ width: 192, flexShrink: 0, display: "none" }} className="prospectus-sidebar">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ padding: "5px 14px", marginBottom: 2 }}>
              <Skeleton height={10} width={i % 3 === 0 ? "80%" : "65%"} />
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* TL;DR */}
          <div className="card" style={{ padding: 24, marginBottom: 4, borderLeft: "3px solid var(--line-hi)" }}>
            <Skeleton height={20} width="120px" radius={3} style={{ marginBottom: 16 }} />
            <Para />
            <Para />
          </div>

          {/* Sections */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div style={{ marginTop: 64, marginBottom: 20 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <Skeleton height={9} width="20px" />
                  <Skeleton height={1} style={{ flex: 1, marginTop: 4 }} />
                </div>
                <Skeleton height={20} width="50%" />
              </div>
              <Para />
              <Para />
              <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                <Skeleton height={12} width="100%" style={{ marginBottom: 8 }} />
                <Skeleton height={12} width="90%" style={{ marginBottom: 8 }} />
                <Skeleton height={12} width="75%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
