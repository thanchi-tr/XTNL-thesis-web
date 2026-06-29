"use client";

import { useState } from "react";
import Link from "next/link";

const QUESTIONS = [
  {
    n: "Q1",
    short: "Am I making money at 85% execution efficiency?",
    body: [
      `The core operational question. If the operator executes the edge at 85% efficiency — not perfectly, but competently — does the system generate positive expected value after all real-world friction?`,
      `The XTNL Monte Carlo engine models this explicitly: every weekly return is capped at 85% of theoretical, random cognitive-drift penalties are applied 30% of weeks, slippage is deducted from winning weeks, and edge decay compounds quarterly. The result is a probability distribution of outcomes at realistic — not optimistic — execution quality. The SESSION_FILTERED core (N=106) records 0.982 R expectancy downstream of the full adversarial filter stack.`,
    ],
    cta: { label: "Run the simulation", href: "/model" },
    chip: "chip-green",
  },
  {
    n: "Q2",
    short: "What is the system's baseline after friction and taxation?",
    body: [
      `Raw expectancy means nothing if it cannot survive live market friction, platform execution costs, and statutory tax obligations. The XTNL pipeline applies an adversarial filter stack to the theoretical dataset before computing any metrics.`,
      `The Haircut filter compresses winners and expands losers to model spread widening. The Operator Efficiency filter caps theoretical yield at 85%. The Toxic Streak filter compounds psychological tilt penalties on each consecutive loss. All projected capital growth is taxed annually at the ATO's maximum rate of 47%. The 0.982 R expectancy reported by the system survives this entire matrix — it is a pessimistic floor, not an optimistic ceiling.`,
    ],
    cta: { label: "View the data", href: "/data" },
    chip: "chip-blue",
  },
  {
    n: "Q3",
    short: "What are the odds this edge is real?",
    body: [
      `Statistical significance testing across N=308 non-overlapping observations. The null hypothesis — that returns are random noise — is rejected with a joint probability of approximately p = 3.48 × 10⁻³³. The System Quality Number (SQN) of 4.253 on the primary session-filtered core (N=106) places the system in the upper tier of quantitative systems by the Van Tharp classification.`,
      `A 95% confidence interval lower bound of 0.529 R means that even at the pessimistic extreme of the statistical estimate, the system is expected to generate positive expectancy. The t-statistic of 4.251 confirms this is not attributable to random variance.`,
    ],
    cta: { label: "Read the thesis", href: "/prospectus#s2" },
    chip: "chip-muted",
  },
  {
    n: "Q4",
    short: "How do I prove the edge is not curve-fitted?",
    body: [
      `Walk-Forward Optimisation (WFO) is the standard methodology for detecting curve-fitting: the model is trained on historical data, then tested on the immediately following period it has never seen. If the edge is real, out-of-sample performance remains consistent. If it is curve-fitted, OOS performance collapses.`,
      `The XTNL WFO engine runs an expanding-window validation across 4 folds. SESSION_FILTERED yields aggregate OOS SQN 1.787 and OOS expectancy 0.904 R — STABLE. Fold 3 showed 77.5% degradation, which is precisely why the 19:00 AEST temporal cluster was identified as a structural toxicity and permanently excised. The system does not ignore its own failures — it routes them into architectural improvements.`,
    ],
    cta: { label: "View WFO data", href: "/data" },
    chip: "chip-muted",
  },
  {
    n: "Q5",
    short: "How does the architecture avoid coupling to the edge?",
    body: [
      `Any specific edge will eventually decay. Market inefficiencies close as participants adapt. The XTNL architecture resolves this through strict structural decoupling between the Tangible Asset Chassis and the Intellectual Property Payload.`,
      `The chassis — the analytics pipeline, risk engine, WFO validator, execution firmware, and capital allocation logic — is permanently owned. The IP (the specific edge definition) is treated as a replaceable payload. If WFO signals critical edge decay, the pipeline halts deployment and the chassis remains intact, ready to validate and load a successor edge. The business never depends on any single market observation surviving indefinitely.`,
    ],
    cta: { label: "Read the thesis", href: "/prospectus#s7" },
    chip: "chip-amber",
  },
];

export default function FiveQuestions() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {QUESTIONS.map(({ n, short, body, cta, chip }, i) => {
        const isOpen = open === i;
        return (
          <div
            key={n}
            className="card"
            style={{
              overflow: "hidden",
              borderColor: isOpen ? "var(--line-hi)" : "var(--line)",
              transition: "border-color 0.2s ease",
            }}
          >
            {/* Trigger */}
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: "100%",
                background: isOpen ? "var(--raised)" : "transparent",
                border: "none",
                cursor: "pointer",
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                textAlign: "left",
                transition: "background 0.18s ease",
              }}
            >
              <span className={`chip ${chip}`} style={{ flexShrink: 0 }}>{n}</span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: isOpen ? "var(--ink-0)" : "var(--ink-1)",
                  flex: 1,
                  lineHeight: 1.4,
                  transition: "color 0.18s ease",
                }}
              >
                {short}
              </span>
              {/* Animated plus / minus */}
              <span
                style={{
                  width: 18, height: 18,
                  border: "1px solid var(--line-hi)",
                  borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.18s, border-color 0.18s",
                  background: isOpen ? "var(--green-10)" : "transparent",
                  borderColor: isOpen ? "rgba(0,204,122,0.3)" : "var(--line-hi)",
                }}
              >
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  style={{ transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)" }}
                >
                  <line x1="5" y1="1" x2="5" y2="9" stroke={isOpen ? "var(--green)" : "var(--ink-2)"} strokeWidth="1.5" strokeLinecap="round"
                    style={{ transform: isOpen ? "scaleY(0)" : "scaleY(1)", transformOrigin: "5px 5px", transition: "transform 0.22s ease" }}
                  />
                  <line x1="1" y1="5" x2="9" y2="5" stroke={isOpen ? "var(--green)" : "var(--ink-2)"} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
            </button>

            {/* Smooth body using CSS grid rows technique */}
            <div
              className={`accordion-body${isOpen ? " open" : ""}`}
            >
              <div className="accordion-inner">
                <div style={{ padding: "0 22px 24px" }}>
                  <div style={{ height: 1, background: "var(--line)", marginBottom: 20 }} />
                  {body.map((para, pi) => (
                    <p
                      key={pi}
                      style={{
                        fontSize: 14,
                        color: "var(--ink-2)",
                        lineHeight: 1.8,
                        marginBottom: pi < body.length - 1 ? 14 : 20,
                      }}
                    >
                      {para}
                    </p>
                  ))}
                  <Link
                    href={cta.href}
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: "7px 16px" }}
                  >
                    {cta.label} →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
