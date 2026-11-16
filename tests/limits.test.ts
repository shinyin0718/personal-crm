import { describe, expect, it } from "vitest";
import { dailyScanLimit, isEmailAllowed, passwordSignupEnabled } from "@/lib/limits";

describe("isEmailAllowed", () => {
  it("allows anyone when the list is empty", () => {
    expect(isEmailAllowed("a@b.com", "")).toBe(true);
    expect(isEmailAllowed("a@b.com", undefined)).toBe(true);
  });
  it("matches exact emails and @domains, case-insensitively", () => {
    const list = "Me@Gmail.com, @northwind.example";
    expect(isEmailAllowed("me@gmail.com", list)).toBe(true);
    expect(isEmailAllowed("Mei@Northwind.example", list)).toBe(true);
    expect(isEmailAllowed("you@gmail.com", list)).toBe(false);
    expect(isEmailAllowed("x@evil-northwind.example", list)).toBe(false);
  });
});

describe("dailyScanLimit", () => {
  it("defaults to 20 and ignores junk", () => {
    expect(dailyScanLimit(undefined)).toBe(20);
    expect(dailyScanLimit("0")).toBe(20);
    expect(dailyScanLimit("abc")).toBe(20);
    expect(dailyScanLimit("5")).toBe(5);
  });
});

describe("passwordSignupEnabled", () => {
  it("is off unless explicitly true", () => {
    expect(passwordSignupEnabled(undefined)).toBe(false);
    expect(passwordSignupEnabled("1")).toBe(false);
    expect(passwordSignupEnabled("true")).toBe(true);
  });
});
