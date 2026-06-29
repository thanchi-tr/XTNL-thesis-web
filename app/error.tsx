"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[XTNL]", error);
  }, [error]);

  return (
    <div
      className="site-container"
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 60,
        paddingBottom: 60,
        textAlign: "center",
      }}
    >
      <span className="chip chip-red" style={{ marginBottom: 24, fontSize: 11 }}>
        Runtime Error
      </span>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--ink-0)",
          marginBottom: 10,
          letterSpacing: "-0.01em",
        }}
      >
        Something went wrong
      </h2>
      <p
        style={{
          fontSize: 13.5,
          color: "var(--ink-2)",
          maxWidth: 400,
          lineHeight: 1.7,
          marginBottom: 36,
        }}
      >
        An unexpected error occurred while rendering this section.
        {error.digest && (
          <span className="mono" style={{ display: "block", marginTop: 8, color: "var(--ink-3)", fontSize: 11 }}>
            Digest: {error.digest}
          </span>
        )}
      </p>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={reset}
          className="btn btn-primary"
          style={{ fontSize: 12 }}
        >
          Try again
        </button>
        <Link href="/" className="btn btn-secondary" style={{ fontSize: 12 }}>
          Back to Overview
        </Link>
      </div>
    </div>
  );
}
