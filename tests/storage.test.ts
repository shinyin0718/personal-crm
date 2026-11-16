import { describe, expect, it } from "vitest";
import { fileUrl, isSafeKey, keyFromUrl } from "@/lib/storage";

describe("storage keys", () => {
  it("accepts user-scoped keys and rejects traversal", () => {
    expect(isSafeKey("user1/cards/abc-123.jpg")).toBe(true);
    expect(isSafeKey("../etc/passwd.txt")).toBe(false);
    expect(isSafeKey("user1/../user2/x.jpg")).toBe(false);
    expect(isSafeKey("/abs/x.jpg")).toBe(false);
  });
  it("round-trips URLs", () => {
    expect(keyFromUrl(fileUrl("u/cards/a.jpg"))).toBe("u/cards/a.jpg");
    expect(keyFromUrl("https://elsewhere.com/x.jpg")).toBeNull();
  });
});
