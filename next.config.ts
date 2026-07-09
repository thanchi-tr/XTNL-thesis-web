import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/* ── Content-Security-Policy ────────────────────────────────────
   'unsafe-inline' on script-src is retained because Next.js App
   Router injects hydration scripts inline. A nonce-based CSP would
   fully eliminate it but requires custom middleware + server component
   changes. 'unsafe-eval' is only added in dev (React DevTools).     */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",    // Tailwind / CSS-in-JS requires inline styles
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",                   // block Flash / plugin embeds
  "worker-src 'self' blob:",             // allow service-worker and chart workers
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

/* ── Security headers applied to every response ─────────────── */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options",                value: "DENY" },
  { key: "X-Content-Type-Options",         value: "nosniff" },
  { key: "X-DNS-Prefetch-Control",         value: "on" },
  { key: "Referrer-Policy",                value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",             value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security",      value: "max-age=63072000; includeSubDomains; preload" },
  /* Cross-origin isolation — prevents Spectre side-channel leaks
     across browsing contexts and shared workers.                  */
  { key: "Cross-Origin-Opener-Policy",     value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy",   value: "same-site" },
  { key: "Content-Security-Policy",        value: CSP },
];

/* ── CORS headers for API routes ───────────────────────────────
   The allowed origin is the canonical app URL. Cross-origin browser
   requests (e.g. from another domain) are explicitly rejected.
   Native clients (Apple Watch app) use Authorization: Bearer and
   are unaffected — CORS restrictions only apply to browsers.      */
const appOrigin =
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
  (isDev ? "http://localhost:3000" : "https://xtnl-solutions.com");

const API_CORS_HEADERS = [
  { key: "Access-Control-Allow-Origin",      value: appOrigin },
  { key: "Access-Control-Allow-Methods",     value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
  { key: "Access-Control-Allow-Headers",     value: "Content-Type, Authorization, X-Requested-With" },
  { key: "Access-Control-Allow-Credentials", value: "true" },
  { key: "Access-Control-Max-Age",           value: "86400" },   // 24-hour preflight cache
  { key: "Vary",                             value: "Origin" },   // correct caching when origin varies
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      /* Security headers on every route */
      {
        source:  "/(.*)",
        headers: SECURITY_HEADERS,
      },
      /* Explicit CORS policy on all API routes */
      {
        source:  "/api/(.*)",
        headers: API_CORS_HEADERS,
      },
    ];
  },
};

export default nextConfig;
