// Golden cases for job 2 (parseStatement). Recorded answers by default; LIVE=1 calls the real model.
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { parseStatement, rangesToIntervals } from "@/lib/ai/parseStatement";

const live = process.env.LIVE === "1";
const timeout = live ? 90_000 : 5_000;
const ZONE = "Asia/Hong_Kong";
const today = DateTime.now().setZone(ZONE);
const window = {
  startDate: today.plus({ days: 1 }).toISODate()!,
  endDate: today.plus({ days: 12 }).toISODate()!,
};

async function run(text: string, timezone = ZONE) {
  const res = await parseStatement({ text, timezone, guestName: "Priya", window });
  if (!res.ok) throw new Error(`parseStatement failed: ${res.error}`);
  return res.data;
}

describe(`parseStatement golden cases (${live ? "LIVE model" : "recorded answers"})`, () => {
  it(
    "Tuesday or Wednesday afternoons, not Mondays",
    async () => {
      const s = await run("Tuesday or Wednesday afternoons, not Mondays");
      expect(s.timezone).toBe(ZONE);
      expect(s.ranges.length).toBeGreaterThanOrEqual(2);
      for (const r of s.ranges) {
        expect(r.start).toBe("12:00");
        expect(r.end).toBe("17:00");
        expect(r.date >= window.startDate && r.date <= window.endDate).toBe(true);
        if (live) expect([2, 3]).toContain(DateTime.fromISO(r.date).weekday);
      }
      expect(s.preferences).toContainEqual(expect.objectContaining({ type: "avoid", days: [1] }));
      expect(s.restatement.length).toBeGreaterThan(10);
      expect(rangesToIntervals(s)).toHaveLength(s.ranges.length);
    },
    timeout,
  );

  it(
    "I'm more available next week: mornings, inside the poll's dates, guest's timezone",
    async () => {
      const s = await run("I'm more available next week, mornings are best for me", "Europe/London");
      expect(s.timezone).toBe("Europe/London");
      expect(s.ranges.length).toBeGreaterThan(0);
      for (const r of s.ranges) {
        expect(r.date >= window.startDate && r.date <= window.endDate).toBe(true);
        expect(r.end <= "12:00").toBe(true);
      }
    },
    timeout,
  );

  it(
    "Read on a Sunday, 'prefer next week' means the poll's week starting tomorrow",
    async () => {
      // The learner's own case: Sunday 25 Oct, poll Mon 26 – Fri 30 Oct.
      const sundayWindow = { startDate: "2026-10-26", endDate: "2026-10-30" };
      const res = await parseStatement({
        text: "I am less free this week. Prefer a meeting next week.",
        timezone: ZONE,
        guestName: "Priya",
        window: sundayWindow,
        now: DateTime.fromISO("2026-10-25T14:00", { zone: ZONE }).toMillis(),
      });
      if (!res.ok) throw new Error(`parseStatement failed: ${res.error}`);
      expect(res.data.ranges.length).toBeGreaterThan(0);
      for (const r of res.data.ranges) {
        expect(r.date >= sundayWindow.startDate && r.date <= sundayWindow.endDate).toBe(true);
      }
    },
    timeout,
  );

  it.skipIf(live)("Unreadable input fails plainly after one retry", async () => {
    const res = await parseStatement({ text: "zzzz", timezone: ZONE, guestName: "Priya", window });
    expect(res.ok).toBe(false);
  });
});
