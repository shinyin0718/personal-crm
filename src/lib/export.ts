export interface ExportPerson {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  tags: string[];
  meetings: { metAt: string; location: string | null; notes: string | null }[];
}

function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  // Stop spreadsheet apps from treating cell text as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(people: ExportPerson[]): string {
  const header = [
    "Name",
    "Email",
    "Phone",
    "Company",
    "Role",
    "LinkedIn",
    "Tags",
    "Notes",
    "Meetings",
    "Last met",
    "Last met at",
  ];
  const rows = people.map((p) => {
    const last = p.meetings[0];
    return [
      p.name,
      p.email,
      p.phone,
      p.company,
      p.role,
      p.linkedinUrl,
      p.tags.join(", "),
      p.notes,
      p.meetings.length,
      last?.metAt,
      last?.location,
    ].map(csvCell);
  });
  return [header, ...rows].map((r) => r.join(",")).join("\r\n") + "\r\n";
}

function vEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

export function toVcard(people: ExportPerson[]): string {
  return people
    .map((p) => {
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vEscape(p.name)}`];
      const parts = p.name.trim().split(/\s+/);
      const family = parts.length > 1 ? parts.pop()! : "";
      lines.push(`N:${vEscape(family)};${vEscape(parts.join(" "))};;;`);
      if (p.company) lines.push(`ORG:${vEscape(p.company)}`);
      if (p.role) lines.push(`TITLE:${vEscape(p.role)}`);
      if (p.email) lines.push(`EMAIL;TYPE=INTERNET:${vEscape(p.email)}`);
      if (p.phone) lines.push(`TEL;TYPE=CELL:${vEscape(p.phone)}`);
      if (p.linkedinUrl) lines.push(`URL:${vEscape(p.linkedinUrl)}`);
      if (p.tags.length) lines.push(`CATEGORIES:${p.tags.map(vEscape).join(",")}`);
      const note = [
        p.notes,
        ...p.meetings.map((m) => [m.metAt, m.location, m.notes].filter(Boolean).join(" - ")),
      ]
        .filter(Boolean)
        .join("\n");
      if (note) lines.push(`NOTE:${vEscape(note)}`);
      lines.push("END:VCARD");
      return lines.join("\r\n");
    })
    .join("\r\n") + "\r\n";
}
