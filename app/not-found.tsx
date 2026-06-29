import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="site-container"
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 60,
        paddingBottom: 60,
        textAlign: "center",
      }}
    >
      <p
        className="mono"
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: "var(--ink-3)",
          lineHeight: 1,
          marginBottom: 24,
          letterSpacing: "-0.05em",
        }}
      >
        404
      </p>

      <div
        style={{
          width: 1,
          height: 60,
          background: "linear-gradient(to bottom, var(--line), transparent)",
          margin: "0 auto 32px",
        }}
      />

      <p
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--ink-0)",
          marginBottom: 10,
          letterSpacing: "-0.01em",
        }}
      >
        Page not found
      </p>
      <p
        style={{
          fontSize: 14,
          color: "var(--ink-2)",
          maxWidth: 380,
          lineHeight: 1.7,
          marginBottom: 40,
        }}
      >
        This section of the XTNL prospectus does not exist or has been moved.
        Navigate using the links below.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/"           className="btn btn-primary"  style={{ fontSize: 12 }}>Overview</Link>
        <Link href="/prospectus" className="btn btn-secondary" style={{ fontSize: 12 }}>Prospectus</Link>
        <Link href="/model"      className="btn btn-secondary" style={{ fontSize: 12 }}>Simulator</Link>
        <Link href="/data"       className="btn btn-secondary" style={{ fontSize: 12 }}>Data</Link>
      </div>
    </div>
  );
}
