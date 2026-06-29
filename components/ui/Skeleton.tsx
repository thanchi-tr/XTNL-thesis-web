interface SkeletonProps {
  height?: number | string;
  width?: string;
  radius?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ height = 16, width = "100%", radius = 4, style }: SkeletonProps) {
  return (
    <div
      className="shimmer"
      style={{ height, width, borderRadius: radius, flexShrink: 0, ...style }}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <Skeleton height={10} width="40%" />
      <Skeleton height={28} width="60%" />
      {Array.from({ length: rows - 1 }).map((_, i) => (
        <Skeleton key={i} height={12} width={i % 2 === 0 ? "80%" : "65%"} />
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 240 }: { height?: number }) {
  return (
    <div
      className="card"
      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton height={11} width="30%" />
        <Skeleton height={20} width="80px" radius={3} />
      </div>
      <div className="shimmer" style={{ height, borderRadius: 6, width: "100%" }} />
    </div>
  );
}
