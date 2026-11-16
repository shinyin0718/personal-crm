/** SIGNUP_ALLOWLIST: comma-separated emails and/or "@domain" entries. Empty = anyone can sign up. */
export function isEmailAllowed(email: string, list = process.env.SIGNUP_ALLOWLIST): boolean {
  const entries = (list ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!entries.length) return true;
  const e = email.trim().toLowerCase();
  return entries.some((x) => (x.startsWith("@") ? e.endsWith(x) : e === x));
}

/** SCAN_DAILY_LIMIT: card reads (uploads + retries) per account per 24 hours. Defaults to 20. */
export function dailyScanLimit(value = process.env.SCAN_DAILY_LIMIT): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

export const limitMessage = () =>
  `You've reached today's limit of ${dailyScanLimit()} card reads. Try again tomorrow, or add the person by hand.`;
