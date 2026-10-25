import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import type { PollRules } from "@/lib/engine/types";
import { whoComesAlong, withPeople } from "@/lib/polls/roster";

const guest = (name: string, over: Partial<Parameters<typeof whoComesAlong>[0][number]> = {}) => ({
  name,
  email: `${name.trim().toLowerCase()}@example.com`,
  remember: true,
  calendarConnectionId: `cal-${name}`,
  isSample: false,
  ...over,
});

describe("whoComesAlong (meet again)", () => {
  it("brings only guests who said remember me and still have a calendar", () => {
    const people = whoComesAlong([
      guest("Priya"),
      guest("Mei", { remember: false }),
      guest("Leo", { calendarConnectionId: null }),
      guest("Jordan"),
    ]);
    expect(people.map((p) => p.name)).toEqual(["Priya", "Jordan"]);
  });

  it("never brings made-up sample guests", () => {
    expect(whoComesAlong([guest("Sam", { isSample: true })])).toEqual([]);
  });

  it("brings each person once, by email, even two people with the same name", () => {
    expect(whoComesAlong([guest("Priya"), guest("priya ")])).toHaveLength(1);
    expect(whoComesAlong([guest("Sam"), guest("Sam", { email: "sam.other@example.com" })])).toHaveLength(2);
  });
});

describe("withPeople", () => {
  const rules: PollRules = {
    organizerName: "Alex",
    organizerTimezone: "Asia/Hong_Kong",
    people: [{ name: "Priya", timezone: "Asia/Hong_Kong", required: true }],
    window: { startDate: "2026-11-02", endDate: "2026-11-06" },
    durationMinutes: 60,
    workingHours: { start: "09:00", end: "17:00" },
    constraints: [],
    reasonableHours: { ...config.reasonableHours },
    onlyIfNecessary: false,
  };

  it("adds people the organizer didn't name, and keeps the ones they did", () => {
    const out = withPeople(rules, [
      { name: "priya", timezone: "Europe/London" },
      { name: "Jordan", timezone: "Europe/London" },
    ]);
    expect(out.people).toEqual([
      { name: "Priya", timezone: "Asia/Hong_Kong", required: true },
      { name: "Jordan", timezone: "Europe/London", required: false },
    ]);
  });
});
