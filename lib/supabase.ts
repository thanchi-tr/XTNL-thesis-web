import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  // Routes will return 500 with a clear message rather than crashing the module
  console.error(
    "[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
    "  SUPABASE_URL must be https://<project-ref>.supabase.co  (NOT the postgres:// connection string)\n" +
    "  Add both to .env.local (dev) and Vercel environment variables (prod)."
  );
}

export const supabase = createClient(url ?? "https://invalid.supabase.co", key ?? "invalid", {
  auth: { persistSession: false },
});

/** Operator user UUID — override via SUPABASE_USER_ID env var */
export const OPERATOR_USER_ID: string | null =
  process.env.SUPABASE_USER_ID?.trim() || null;
