interface CodeBlockProps {
  filename: string;
  children: string;
}

/* ── XSS mitigation ─────────────────────────────────────────────
   CodeBlock renders pre-formatted syntax-highlighted HTML (span
   tags from the prospectus constants). dangerouslySetInnerHTML is
   required to preserve that colouring; this sanitizer ensures only
   <span> elements with a class attribute pass through — every other
   tag, attribute, or JavaScript URI is stripped before render.     */
function sanitize(html: string): string {
  return (
    html
      /* Remove script, style, iframe, object and any other non-span tag */
      .replace(/<(?!\/?span[\s>\/])/gi, "&lt;")
      /* For every <span ...> that survived, strip all attrs except class */
      .replace(/<span([^>]*)>/gi, (_m, attrs: string) => {
        const cls = attrs.match(/\bclass="([^"<>&]*)"/i);
        /* Further sanitize class values: only a-z, 0-9, hyphens, spaces */
        const safe = cls ? cls[1].replace(/[^a-zA-Z0-9 \-_]/g, "") : "";
        return safe ? `<span class="${safe}">` : "<span>";
      })
      /* Strip any javascript: / data: URIs that snuck through */
      .replace(/\b(?:javascript|vbscript|data):/gi, "blocked:")
  );
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

      {/* Code — sanitized before render */}
      <pre
        className="overflow-x-auto p-5 mono"
        style={{
          fontSize: 12.5,
          lineHeight: 1.7,
          color: "#c9d1d9",
        }}
        dangerouslySetInnerHTML={{ __html: sanitize(children) }}
      />
    </div>
  );
}
