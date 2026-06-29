import { Skeleton, SkeletonChart } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="site-container" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <div style={{ marginBottom: 48 }}>
        <Skeleton height={10} width="20%" style={{ marginBottom: 14 }} />
        <Skeleton height={40} width="50%" style={{ marginBottom: 14 }} />
        <Skeleton height={15} width="80%" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton height={9} width="65%" />
            <div style={{ display: "flex", gap: 8 }}>
              <Skeleton height={20} width="80px" radius={3} />
              <Skeleton height={20} width="70px" radius={3} />
            </div>
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <Skeleton height={11} width="50%" />
                <Skeleton height={11} width="22%" />
              </div>
            ))}
          </div>
        ))}
      </div>

      <SkeletonChart height={240} />
      <div style={{ marginTop: 16 }}>
        <SkeletonChart height={240} />
      </div>
      <div style={{ marginTop: 16 }}>
        <SkeletonChart height={280} />
      </div>
    </div>
  );
}
