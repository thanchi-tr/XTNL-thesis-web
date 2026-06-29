interface CodeBlockProps {
  filename: string;
  children: string;
}

export default function CodeBlock({ filename, children }: CodeBlockProps) {
  return (
    <div
      className="rounded my-8 overflow-hidden"
      style={{
        background: "var(--canvas)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--line)", background: "var(--sub)" }}
      >
        <span className="flex gap-1.5">
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#f43f5e", display: "block" }} />
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#eab308", display: "block" }} />
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22c55e", display: "block" }} />
        </span>
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--ink-2)" }}
        >
          {filename}
        </span>
      </div>

      {/* Code */}
      <pre
        className="overflow-x-auto p-5 mono"
        style={{
          fontSize: 12.5,
          lineHeight: 1.7,
          color: "#c9d1d9",
        }}
        dangerouslySetInnerHTML={{ __html: children }}
      />
    </div>
  );
}
