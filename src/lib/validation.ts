import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => (v === "" ? null : v));

export const emailField = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));

export const credentialsSchema = z.object({
  email: emailField,
  password: z.string().min(8, "At least 8 characters").max(200),
});

export const signupSchema = credentialsSchema.extend({
  name: text(100),
});

export function normalizeLinkedinUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    url.protocol = "https:";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function parseTags(raw: string): string[] {
  const seen = new Map<string, string>();
  for (const part of raw.split(",")) {
    const tag = part.trim().replace(/\s+/g, " ").slice(0, 40);
    if (tag && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
  }
  return [...seen.values()].slice(0, 20);
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const personSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("Enter a valid email").nullable()),
  phone: text(50),
  company: text(200),
  role: text(200),
  linkedinUrl: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const url = normalizeLinkedinUrl(v);
      if (!url) {
        ctx.addIssue({ code: "custom", message: "Enter a linkedin.com link" });
        return z.NEVER;
      }
      return url;
    }),
  notes: text(5000),
  tags: z.string().transform(parseTags),
});

export const interactionSchema = z.object({
  metAt: dateString,
  location: text(200),
  notes: text(10000),
});

// The first meeting is optional when adding someone: all fields empty means skip.
export const firstMeetingSchema = z.object({
  metAt: z.union([z.literal(""), dateString]),
  location: text(200),
  notes: text(10000),
});

export type FieldErrors = Record<string, string>;

export function formValues(fd: FormData, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));
}

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
