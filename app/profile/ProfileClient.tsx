"use client";

type User = { email: string; name: string };

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "XT";
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", fontWeight: 600, color: accent ?? "var(--ink-1)" }}>{value}</span>
    </div>
  );
}

function Card({ title, chip, children }: { title: string; chip?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)", letterSpacing: "-0.01em" }}>{title}</span>
        {chip}
      </div>
      <div style={{ padding: "0 20px 4px" }}>{children}</div>
    </div>
  );
}

const ROLES = [
  {
    id: "operator",
    label: "Operator",
    color: "#00cc7a",
    description: "Active trade execution and real-time session management.",
    capabilities: ["Session Journal", "Entry Checklist", "Focus Alerts", "Trade Log", "Risk Alerts"],
  },
  {
    id: "analyst",
    label: "Analyst",
    color: "#4d9cf5",
    description: "Data review, performance analysis, and session audit.",
    capabilities: ["Analytics Page", "Session Audit", "LLM Mirror", "Checklist Toggle", "Simulator"],
  },
  {
    id: "moderator",
    label: "Moderator",
    color: "#f0a030",
    description: "Platform oversight, compliance review, and content governance.",
    capabilities: ["Moderator Panel", "User Review", "Compliance Flag", "Session Lock"],
  },
  {
    id: "strategist",
    label: "Strategist",
    color: "#a78bfa",
    description: "Algorithm governance, risk parameter design, and strategy authoring.",
    capabilities: ["Algorithm Config", "Risk Params", "Prospectus Edit", "Full Data Access"],
  },
] as const;

function RoleCard({ role }: { role: typeof ROLES[number] }) {
  return (
    <div style={{
      background: "var(--card)", borderRadius: 8, overflow: "hidden",
      border: `1px solid rgba(255,255,255,0.06)`,
      borderLeft: `3px solid ${role.color}`,
    }}>
      <div style={{ padding: "14px 18px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800,
            letterSpacing: "0.10em", textTransform: "uppercase",
            color: role.color,
          }}>
            {role.label}
          </span>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          {role.description}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px" }}>
          {role.capabilities.map(cap => (
            <span key={cap} style={{
              fontSize: 9.5, fontFamily: "var(--font-mono)", fontWeight: 500,
              padding: "2px 7px", borderRadius: 3,
              background: `${role.color}0f`,
              border: `1px solid ${role.color}28`,
              color: role.color,
              letterSpacing: "0.02em",
            }}>
              {cap}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProfileClient({ user }: { user: User }) {
  const ini = initials(user.name || user.email);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <div className="site-container" style={{ paddingTop: 32, maxWidth: 760 }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <p className="section-eyebrow" style={{ color: "var(--green)", marginBottom: 6 }}>Account</p>
          <h1 style={{ margin: 0, fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink-0)" }}>
            Profile
          </h1>
          <div style={{ height: 1, background: "var(--line)", marginTop: 16 }} />
        </div>

        {/* Avatar + identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32, flexWrap: "wrap" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, rgba(0,204,122,0.18) 0%, rgba(77,156,245,0.18) 100%)",
            border: "1.5px solid rgba(0,204,122,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>{ini}</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink-0)", letterSpacing: "-0.02em" }}>
              {user.name || "—"}
            </p>
            <p className="mono" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-2)" }}>{user.email}</p>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span className="chip chip-green" style={{ fontSize: 10 }}>
              <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "var(--green)", marginRight: 5, verticalAlign: "middle" }} />
              Active
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Account details */}
          <Card title="Account Details">
            <Row label="Full Name"  value={user.name  || "—"} />
            <Row label="Email"      value={user.email || "—"} accent="var(--blue)" />
            <Row label="Entity"     value="XTNL Solutions" />
            <Row label="System"     value="v5.2.5 Firmware · EUR/USD" accent="var(--ink-2)" />
          </Card>

          {/* Security */}
          <Card
            title="Security"
            chip={<span className="chip chip-green" style={{ fontSize: 9 }}>2FA Active</span>}
          >
            <Row label="Authentication"   value="Microsoft OAuth 2.0" />
            <Row label="2-Factor (TOTP)"  value="Enabled · SHA-1 · 30s" accent="var(--green)" />
            <Row label="Session"          value="Verified" accent="var(--green)" />
            <Row label="Password"         value="Managed by Microsoft" accent="var(--ink-3)" />
          </Card>

          {/* System Roles */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 14px" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)", letterSpacing: "-0.01em" }}>System Roles</span>
              <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>4 roles · XTNL v5</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
              {ROLES.map(role => (
                <RoleCard key={role.id} role={role} />
              ))}
            </div>
          </div>

          {/* Access */}
          <Card title="Access & Permissions">
            <Row label="Session Page"   value="Full Access" accent="var(--green)" />
            <Row label="Analytics Page" value="Full Access" accent="var(--green)" />
            <Row label="Simulator"      value="Full Access" accent="var(--green)" />
            <Row label="Data Page"      value="Full Access" accent="var(--green)" />
            <Row label="Prospectus"     value="Full Access" accent="var(--green)" />
          </Card>

        </div>
      </div>
    </div>
  );
}
