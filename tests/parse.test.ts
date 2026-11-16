import { describe, expect, it } from "vitest";
import { cardFieldsFromJson, extractJsonObject, toCardFields } from "@/lib/vision/parse";

describe("extractJsonObject", () => {
  it("reads JSON wrapped in a markdown fence", () => {
    expect(extractJsonObject('Here you go:\n```json\n{"name":"Jane"}\n```')).toEqual({ name: "Jane" });
  });
});

describe("toCardFields", () => {
  it("normalises model output", () => {
    const f = toCardFields({
      name: "Jane Doe",
      email: "mailto:Jane@Example.com",
      phone: "+60 12 345",
      company: "Acme",
      role: "CTO",
      linkedin_url: "linkedin.com/in/janedoe",
      website: "acme.com",
    });
    expect(f).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+60 12 345",
      company: "Acme",
      role: "CTO",
      linkedinUrl: "https://linkedin.com/in/janedoe",
    });
  });
  it("drops invalid emails", () => {
    expect(toCardFields({ name: "X", email: "not an email" }).email).toBeNull();
  });
});

describe("cardFieldsFromJson", () => {
  it("returns empty fields for unusable data", () => {
    expect(cardFieldsFromJson(null).name).toBeNull();
  });
});
