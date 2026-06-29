interface SectionHeaderProps {
  number: string;
  title: string;
  id?: string;
}

export default function SectionHeader({ number, title, id }: SectionHeaderProps) {
  return (
    <div id={id} className="mt-20 mb-7 scroll-mt-20">
      <div className="flex items-center gap-3 mb-3">
        <span
          className="mono font-semibold"
          style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--green)", textTransform: "uppercase" }}
        >
          §{number}
        </span>
        <div style={{ height: 1, flex: 1, background: "var(--line)" }} />
      </div>
      <h2
        className="font-semibold tracking-wide"
        style={{
          fontSize: 13,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-0)",
        }}
      >
        {title}
      </h2>
    </div>
  );
}
