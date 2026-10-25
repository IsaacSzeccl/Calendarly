import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safeNext";

const here = "http://localhost:3000/auth/sign-in";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/poll/abc?x=1", here)).toBe("/poll/abc?x=1");
  });

  it("refuses other sites, however they are disguised", () => {
    for (const raw of ["//evil.com", "/\\evil.com", "/\t/evil.com", "https://evil.com/new", "javascript:alert(1)"]) {
      expect(safeNext(raw, here)).toBe("/new");
    }
  });
});
