// Interaction dates are date-only (Postgres DATE), so they arrive as UTC midnight.
export function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDateInput(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
