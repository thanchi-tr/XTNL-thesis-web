import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="site-container" style={{ paddingTop: 64, paddingBottom: 96 }}>
      {/* Hero skeleton */}
      <div style={{ maxWidth: 700, marginBottom: 72 }}>
        <Skeleton height={10} width="28%" style={{ marginBottom: 20 }} />
        <Skeleton height={52} width="80%" style={{ marginBottom: 12 }} />
        <Skeleton height={52} width="55%" style={{ marginBottom: 28 }} />
        <Skeleton height={16} width="90%" style={{ marginBottom: 8 }} />
        <Skeleton height={16} width="75%" style={{ marginBottom: 40 }} />
        <div style={{ display: "flex", gap: 12 }}>
          <Skeleton height={44} width="160px" radius={5} />
          <Skeleton height={44} width="140px" radius={5} />
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 64,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton height={9} width="50%" />
            <Skeleton height={28} width="70%" />
          </div>
        ))}
      </div>
    </div>
  );
}
