"use client";

const SECTIONS = [
  { id: "s1",  n: "1",  title: "Thesis" },
  { id: "s2",  n: "2",  title: "Edge" },
  { id: "s3",  n: "3",  title: "Filters" },
  { id: "s4",  n: "4",  title: "WFO / 19:00" },
  { id: "s5",  n: "5",  title: "HMM Oracle" },
  { id: "s6",  n: "6",  title: "CVaR" },
  { id: "s7",  n: "7",  title: "IP Decoupling" },
  { id: "s8",  n: "8",  title: "Operator Arch." },
  { id: "s9",  n: "9",  title: "Friction Model" },
  { id: "s10", n: "10", title: "Simulation" },
  { id: "s11", n: "11", title: "Taxation" },
  { id: "s12", n: "12", title: "Agency Problem" },
  { id: "s13", n: "13", title: "LLM Auditor" },
  { id: "s14", n: "14", title: "Test Coverage" },
];

export default function QuickJump() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {SECTIONS.map(({ id, n, title }) => (
        <a
          key={id}
          href={`#${id}`}
          className="nav-link"
          style={{
            background: "var(--sub)",
            border: "1px solid var(--line)",
            borderRadius: 4,
            padding: "5px 10px",
            fontSize: 10,
            letterSpacing: "0.08em",
          }}
        >
          §{n} {title}
        </a>
      ))}
    </div>
  );
}
