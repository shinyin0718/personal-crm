import { z } from "zod";
import { normalizeLinkedinUrl } from "@/lib/validation";

export const CARD_FIELDS = ["name", "email", "phone", "company", "role", "linkedinUrl"] as const;
export type CardField = (typeof CARD_FIELDS)[number];
export type CardFields = Record<CardField, string | null>;

export const CARD_PROMPT = `You are reading a photo of a business (name) card.
Return ONLY a JSON object with these keys (use null when a value is not on the card):
- "name": the person's full name
- "email": the person's email address
- "phone": the main phone number, as printed (prefer mobile if several)
- "company": the company or organisation name
- "role": the person's job title
- "linkedin_url": a LinkedIn profile URL if printed
- "website": company website if printed
- "address": postal address if printed
- "other_phones": array of any other phone numbers
Do not guess or invent values. Copy text exactly as printed.`;

export const CARD_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    company: { type: ["string", "null"] },
    role: { type: ["string", "null"] },
    linkedin_url: { type: ["string", "null"] },
    website: { type: ["string", "null"] },
    address: { type: ["string", "null"] },
    other_phones: { type: "array", items: { type: "string" } },
  },
  required: ["name", "email", "phone", "company", "role", "linkedin_url"],
} as const;

const loose = z
  .unknown()
  .optional()
  .transform((v) => (typeof v === "string" ? v.trim() || null : null));

const responseSchema = z.looseObject({
  name: loose,
  email: loose,
  phone: loose,
  company: loose,
  role: loose,
  linkedin_url: loose,
});

/** Strip Markdown fences / surrounding prose and parse the first JSON object. */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model response");
  return JSON.parse(body.slice(start, end + 1));
}

export function toCardFields(raw: unknown): CardFields {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Model response was not an object");
  const r = parsed.data;
  const email = r.email?.replace(/^mailto:/i, "").toLowerCase() ?? null;
  return {
    name: r.name,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    phone: r.phone,
    company: r.company,
    role: r.role,
    linkedinUrl: r.linkedin_url ? normalizeLinkedinUrl(r.linkedin_url) : null,
  };
}

/** Read saved extracted_json back into form fields (tolerates old/partial data). */
export function cardFieldsFromJson(json: unknown): CardFields {
  try {
    return toCardFields(json);
  } catch {
    return { name: null, email: null, phone: null, company: null, role: null, linkedinUrl: null };
  }
}
