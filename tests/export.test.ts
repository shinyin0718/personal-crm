import { describe, expect, it } from "vitest";
import { toCsv, toVcard, type ExportPerson } from "@/lib/export";

const jane: ExportPerson = {
  name: "Jane, Doe",
  email: "jane@example.com",
  phone: "=HYPERLINK(1)",
  company: "Acme",
  role: null,
  linkedinUrl: null,
  notes: 'Says "hi"',
  tags: ["a", "b"],
  meetings: [{ metAt: "2026-11-12", location: "Summit", notes: null }],
};

describe("toCsv", () => {
  it("quotes and neutralises formulas", () => {
    const csv = toCsv([jane]);
    expect(csv).toContain('"Jane, Doe"');
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain('"Says ""hi"""');
  });
});

describe("toVcard", () => {
  it("escapes commas and includes contact fields", () => {
    const vcf = toVcard([jane]);
    expect(vcf).toContain("BEGIN:VCARD");
    expect(vcf).toContain("FN:Jane\\, Doe");
    expect(vcf).toContain("EMAIL;TYPE=INTERNET:jane@example.com");
  });
});
