interface MetricCardProps {
  label: string;
  value: string;
  color?: "green" | "red" | "blue";
  sub?: string;
}
const C = { green: "var(--green)", red: "var(--red)", blue: "var(--blue)" };

export default function MetricCard({ label, value, color = "green", sub }: MetricCardProps) {
  return (
    <div
      className="card card-hover"
      style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 8 }}
    >
      <span className="label-xs">{label}</span>
      <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: C[color], lineHeight: 1 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5 }}>{sub}</span>}
    </div>
  );
}
