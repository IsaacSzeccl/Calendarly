import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { parseStatementPrompt } from "@/lib/ai/parseStatement";

// The model is told which dates "this week" and "next week" are, so it never counts days itself.
describe("parseStatementPrompt weeks", () => {
  const prompt = (iso: string) =>
    parseStatementPrompt({
      text: "I am less free this week. Prefer a meeting next week.",
      today: DateTime.fromISO(iso, { zone: "Asia/Hong_Kong" }),
      guestName: "Priya",
      window: { startDate: "2026-10-26", endDate: "2026-10-30" },
    });

  it("on a Sunday, next week starts tomorrow", () => {
    const p = prompt("2026-10-25T14:00");
    expect(p).toContain('"This week" is 2026-10-19 to 2026-10-25.');
    expect(p).toContain('"Next week" is 2026-10-26 to 2026-11-01.');
  });

  it("midweek, this week is the current Monday to Sunday", () => {
    const p = prompt("2026-10-28T09:00");
    expect(p).toContain('"This week" is 2026-10-26 to 2026-11-01.');
    expect(p).toContain('"Next week" is 2026-11-02 to 2026-11-08.');
  });
});
