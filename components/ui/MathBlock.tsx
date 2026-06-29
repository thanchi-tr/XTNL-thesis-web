"use client";

import { useEffect, useRef } from "react";

interface MathBlockProps {
  latex: string;
  display?: boolean;
  /** When true, renders inline with no outer padding/border (for use inside FormulaGroup) */
  bare?: boolean;
}

export default function MathBlock({ latex, display = true, bare = false }: MathBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    import("katex").then((katex) => {
      if (ref.current) {
        katex.default.render(latex, ref.current, {
          throwOnError: false,
          displayMode: display,
        });
      }
    });
  }, [latex, display]);

  if (bare) {
    return (
      <div
        ref={ref}
        style={{ overflow: "auto", color: "#eef2f8", textAlign: display ? "center" : "left" }}
      />
    );
  }

  return (
    <div
      ref={ref}
      className="overflow-x-auto my-4 px-6 py-5 rounded text-center"
      style={{
        background: "var(--sub)",
        border: "1px solid var(--line)",
        fontSize: 15,
        color: "#eef2f8",
      }}
    />
  );
}
