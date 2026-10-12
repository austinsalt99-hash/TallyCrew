import { pickFields } from "@/lib/billing";

const CLIENT_FIELDS = ["name", "email", "phone", "address", "notes"] as const;

// Trims every field; blank optional fields become null.
export function cleanClientFields(body: Record<string, unknown>): Record<string, string | null> {
  const picked = pickFields(body, CLIENT_FIELDS);
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(picked)) out[k] = typeof v === "string" && v.trim() ? v.trim() : null;
  return out;
}
