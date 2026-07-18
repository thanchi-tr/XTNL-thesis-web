"use client";

import { useCallback, useEffect, useState } from "react";

type ShowToast = (kind: "success" | "error", text: string) => void;

interface SignoffStatus {
  signedOff:   boolean;
  signedOffBy: string | null;
  signedOffAt: string | null;
}

/**
 * Copies the generated PineScript firmware to the clipboard. Stays disabled
 * until the analyst has signed off the current week's review (see
 * /api/session/weekly-signoff — POST is analyst-only, GET is read for
 * everyone this button is rendered for). Self-contained: fetches its own
 * signoff status and shows its own copy/error feedback (matching CopyCell's
 * transient-state idiom in SessionClient.tsx) so it works standalone on
 * pages with no toast system (e.g. AnalyticsClient.tsx). `showToast` is
 * optional — if the host page has one (SessionClient.tsx), it's used too.
 */
export default function FirmwareCopyButton({
  showToast,
  refreshSignal,
}: {
  showToast?: ShowToast;
  refreshSignal?: number;
}) {
  const [status,  setStatus]  = useState<SignoffStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "error">("idle");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/session/weekly-signoff");
      if (r.ok) {
        const j = await r.json();
        setStatus({ signedOff: j.signedOff, signedOffBy: j.signedOffBy, signedOffAt: j.signedOffAt });
      } else {
        setStatus({ signedOff: false, signedOffBy: null, signedOffAt: null });
      }
    } catch {
      setStatus({ signedOff: false, signedOffBy: null, signedOffAt: null });
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchStatus(); }, [fetchStatus, refreshSignal]);

  const handleCopy = useCallback(async () => {
    setCopyState("copying");
    try {
      const r = await fetch("/api/session/firmware");
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Failed to fetch firmware");
      const text = await r.text();
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      showToast?.("success", "Firmware copied to clipboard");
    } catch (e) {
      setCopyState("error");
      showToast?.("error", e instanceof Error ? e.message : "Could not copy firmware");
    }
    setTimeout(() => setCopyState("idle"), 1600);
  }, [showToast]);

  const disabled = loading || !status?.signedOff || copyState === "copying";

  const label =
    copyState === "copied"  ? "✓ Copied!" :
    copyState === "error"   ? "Copy failed — retry" :
    copyState === "copying" ? "Copying…" :
    loading                 ? "Checking sign-off…" :
    status?.signedOff       ? "Copy Firmware" :
    "Locked — sign off this week first";

  return (
    <button
      className="btn btn-secondary"
      onClick={handleCopy}
      disabled={disabled}
      title={
        status?.signedOff
          ? `Signed off by ${status.signedOffBy ?? "analyst"}`
          : "Available once this week's review is signed off"
      }
      style={{
        opacity: disabled && copyState !== "copying" ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        color:
          copyState === "copied" ? "var(--green)" :
          copyState === "error"  ? "var(--red)"   :
          undefined,
        transition: "color 0.2s, opacity 0.2s",
      }}
    >
      {label}
    </button>
  );
}
