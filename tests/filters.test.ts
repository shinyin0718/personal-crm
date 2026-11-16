import { describe, expect, it } from "vitest";
import { activeFilterCount, buildPeopleWhere, parseFilters } from "@/lib/filters";

describe("parseFilters", () => {
  it("ignores malformed dates and defaults sort", () => {
    const f = parseFilters({ q: " jane ", from: "2026-13", to: "2026-11-01" });
    expect(f).toMatchObject({ q: "jane", from: "", to: "2026-11-01", sort: "recent" });
    expect(activeFilterCount(f)).toBe(1);
  });
});

describe("buildPeopleWhere", () => {
  it("always scopes to the user", () => {
    const where = buildPeopleWhere("user_1", parseFilters({ q: "acme", event: "summit", from: "2026-01-01" }));
    expect(where.userId).toBe("user_1");
    expect(JSON.stringify(where)).toContain("summit");
  });
});

describe("date filters", () => {
  it("ignores impossible calendar dates", () => {
    const f = parseFilters({ from: "2026-13-01", to: "2026-02-30" });
    expect(f.from).toBe("");
    expect(f.to).toBe("");
    expect(parseFilters({ from: "2024-02-29" }).from).toBe("2024-02-29");
  });
});
