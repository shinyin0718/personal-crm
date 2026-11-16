import { describe, expect, it } from "vitest";
import { normalizeLinkedinUrl, parseTags, personSchema } from "@/lib/validation";

describe("normalizeLinkedinUrl", () => {
  it("adds https and keeps linkedin profile URLs", () => {
    expect(normalizeLinkedinUrl("linkedin.com/in/jane")).toBe("https://linkedin.com/in/jane");
    expect(normalizeLinkedinUrl("http://www.linkedin.com/in/jane")).toMatch(/^https:\/\/www\.linkedin\.com\/in\/jane/);
  });
  it("rejects other hosts", () => {
    expect(normalizeLinkedinUrl("https://evil.com/linkedin.com")).toBeNull();
    expect(normalizeLinkedinUrl("https://linkedin.com.evil.com/in/x")).toBeNull();
  });
});

describe("parseTags", () => {
  it("trims, drops empties and de-duplicates case-insensitively", () => {
    expect(parseTags(" fintech, Mentor,,fintech , FINTECH")).toEqual(["fintech", "Mentor"]);
  });
});

describe("personSchema", () => {
  it("turns empty optional fields into null", () => {
    const r = personSchema.parse({ name: "Jane", email: "", phone: "", company: "", role: "", linkedinUrl: "", notes: "", tags: "" });
    expect(r.email).toBeNull();
    expect(r.linkedinUrl).toBeNull();
  });
  it("requires a name", () => {
    expect(personSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});
