export interface SopInput {
  title: string;
  tags:  string[];
  items: string[];
}

export type SopValidationResult =
  | { ok: true; value: SopInput }
  | { ok: false; error: string };

/** Shared by the SOP checklist POST (create) and PUT (update) routes. */
export function validateSopInput(body: unknown): SopValidationResult {
  if (typeof body !== "object" || body === null)
    return { ok: false, error: "Invalid request body" };

  const b = body as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required" };
  if (title.length > 200) return { ok: false, error: "Title must be 200 characters or fewer" };

  if (!Array.isArray(b.items)) return { ok: false, error: "items must be an array" };
  const items = b.items
    .filter((i): i is string => typeof i === "string")
    .map(i => i.trim())
    .filter(Boolean);
  if (items.length < 1)  return { ok: false, error: "At least 1 checklist row is required" };
  if (items.length > 12) return { ok: false, error: "At most 12 checklist rows are allowed" };
  if (items.some(i => i.length > 300))
    return { ok: false, error: "Each row must be 300 characters or fewer" };

  const tagsRaw = Array.isArray(b.tags) ? b.tags : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const t of tagsRaw) {
    if (typeof t !== "string") continue;
    const trimmed = t.trim();
    if (!trimmed || trimmed.length > 40) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(trimmed);
    if (tags.length >= 20) break;
  }

  return { ok: true, value: { title, tags, items } };
}
