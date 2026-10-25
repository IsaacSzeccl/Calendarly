import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import {
  addAiSlots,
  buildCandidatePool,
  chooseInitialOptions,
  rulePenalties,
  ruleScore,
} from "@/lib/engine/slots";
import { insideClock, localWeekday, overlapsClock } from "@/lib/engine/time";
import type { PollRules, SlotOption } from "@/lib/engine/types";

const NY = "America/New_York";
const LONDON = "Europe/London";
// Sunday 25 Oct 2026, noon in New York. The window is Mon 26 – Fri 30 Oct.
const NOW = DateTime.fromISO("2026-10-25T12:00", { zone: NY }).toMillis();
const at = (iso: string, zone = NY) => DateTime.fromISO(iso, { zone }).toMillis();
const hourMs = 3_600_000;

function rules(over: Partial<PollRules> = {}): PollRules {
  return {
    organizerName: "You",
    organizerTimezone: NY,
    people: [],
    window: { startDate: "2026-10-26", endDate: "2026-10-30" },
    durationMinutes: 60,
    workingHours: { start: "09:00", end: "17:00" },
    constraints: [],
    reasonableHours: { ...config.reasonableHours },
    onlyIfNecessary: false,
    ...over,
  };
}

const tomJamie = rules({
  people: [
    { name: "Tom", timezone: NY, required: false },
    { name: "Jamie", timezone: LONDON, required: false, hours: { start: "09:00", end: "18:00" } },
  ],
  constraints: [
    {
      appliesTo: "everyone",
      type: "prefer",
      strength: "soft",
      timeOfDay: "afternoon",
      description: "Best to be afternoon meetings",
    },
    {
      appliesTo: "Tom",
      type: "avoid",
      strength: "soft",
      timeOfDay: "night",
      description: "Tom does not like meetings at night",
    },
  ],
});

describe("config is pinned", () => {
  it("keeps the agreed numbers", () => {
    expect(config.slotStepMinutes).toBe(15);
    expect(config.aiSlotCap).toBe(3);
    expect(config.reasonableHours).toEqual({ start: "08:00", end: "21:00" });
    expect(config.weights).toMatchObject({ no: 10, requiredNo: 1000, preferNot: 3, unmarked: 1, softConstraint: 2 });
  });
});

describe("buildCandidatePool", () => {
  it("moves in 15-minute steps inside the organizer's working hours", () => {
    const pool = buildCandidatePool(rules(), [], NOW);
    expect(pool.length).toBeGreaterThan(0);
    for (const s of pool) {
      expect(s.start % (15 * 60_000)).toBe(0);
      expect(s.end - s.start).toBe(hourMs);
      expect(insideClock(s, { start: "09:00", end: "17:00" }, NY)).toBe(true);
    }
    // 9:00 to 16:00 starts = 29 per day, 5 days.
    expect(pool.length).toBe(29 * 5);
  });

  it("leaves out the organizer's busy time", () => {
    const busy = [{ start: at("2026-10-26T09:00"), end: at("2026-10-26T17:00") }];
    const pool = buildCandidatePool(rules(), busy, NOW);
    expect(pool.some((s) => s.start < at("2026-10-27T00:00"))).toBe(false);
  });

  it("never offers a time in the past", () => {
    const now = at("2026-10-26T15:00");
    const pool = buildCandidatePool(rules(), [], now);
    expect(Math.min(...pool.map((s) => s.start))).toBe(now);
  });

  it("drops times outside reasonable hours in each person's own timezone", () => {
    // 9–17 in New York is 22:00–06:00 in Tokyo.
    const r = rules({ people: [{ name: "Aiko", timezone: "Asia/Tokyo", required: false }] });
    expect(buildCandidatePool(r, [], NOW)).toEqual([]);
  });

  it("removes slots that break a hard rule about the organizer", () => {
    const r = rules({
      constraints: [
        { appliesTo: "organizer", type: "avoid", strength: "hard", days: [2], description: "can't do Tuesdays" },
      ],
    });
    const pool = buildCandidatePool(r, [], NOW);
    expect(pool.some((s) => localWeekday(s.start, NY) === 2)).toBe(false);
    expect(pool.length).toBe(29 * 4);
  });

  it("keeps slots that break a hard rule about one guest, scored as their predicted no", () => {
    const r = rules({
      people: [{ name: "Leo", timezone: NY, required: false }],
      constraints: [
        { appliesTo: "Leo", type: "prefer", strength: "hard", timeOfDay: "evening", description: "only does evenings" },
      ],
    });
    const pool = buildCandidatePool(r, [], NOW);
    expect(pool.length).toBe(29 * 5);
    expect(rulePenalties(pool[0], r)).toEqual([
      { reason: "only does evenings", person: "Leo", points: config.weights.no },
    ]);
  });

  it("scores a required person's predicted no as very large", () => {
    const r = rules({
      people: [{ name: "Sam", timezone: NY, required: true, hours: { start: "13:00", end: "17:00" } }],
    });
    const morning = { start: at("2026-10-26T09:00"), end: at("2026-10-26T10:00") };
    expect(ruleScore(morning, r)).toBe(config.weights.requiredNo);
  });
});

describe("chooseInitialOptions (Tom and Jamie)", () => {
  const pool = buildCandidatePool(tomJamie, [], NOW);
  const options = chooseInitialOptions(pool, tomJamie);

  it("picks five options on five different days", () => {
    expect(options).toHaveLength(5);
    const days = new Set(options.map((o) => DateTime.fromMillis(o.start, { zone: NY }).toISODate()));
    expect(days.size).toBe(5);
  });

  it("puts every option in the afternoon in New York and inside Jamie's 9–6 in London", () => {
    for (const o of options) {
      expect(ruleScore(o, tomJamie)).toBe(0);
      expect(insideClock(o, { start: "12:00", end: "17:00" }, NY)).toBe(true);
      expect(insideClock(o, { start: "09:00", end: "18:00" }, LONDON)).toBe(true);
    }
  });

  it("is deterministic: ties go to the earliest time (12:00 New York)", () => {
    expect(options.map((o) => DateTime.fromMillis(o.start, { zone: NY }).toFormat("ccc HH:mm"))).toEqual([
      "Mon 12:00",
      "Tue 12:00",
      "Wed 12:00",
      "Thu 12:00",
      "Fri 12:00",
    ]);
  });

  it("handles the London clock change: Jamie is GMT (UTC+0) that week", () => {
    const first = DateTime.fromMillis(options[0].start, { zone: LONDON });
    expect(first.offset).toBe(0);
    expect(first.toFormat("HH:mm")).toBe("16:00");
  });
});

describe("addAiSlots", () => {
  const existing: SlotOption[] = [
    { id: "a", source: "organizer_free", start: at("2026-10-27T13:00"), end: at("2026-10-27T14:00") },
  ];
  const base = { rules: rules(), organizerBusy: [], existing, aiAddedSoFar: 0, now: NOW };

  it("adds a slot inside a proposed range where the organizer is free", () => {
    const res = addAiSlots({ ...base, ranges: [{ start: at("2026-10-28T13:00"), end: at("2026-10-28T17:00") }] });
    expect(res.added).toEqual([{ start: at("2026-10-28T13:00"), end: at("2026-10-28T14:00") }]);
  });

  it("refuses ranges where the organizer is busy", () => {
    const res = addAiSlots({
      ...base,
      organizerBusy: [{ start: at("2026-10-28T09:00"), end: at("2026-10-28T17:00") }],
      ranges: [{ start: at("2026-10-28T13:00"), end: at("2026-10-28T17:00") }],
    });
    expect(res.added).toEqual([]);
    expect(res.skipped[0].why).toBe("busy");
  });

  it("does not duplicate an existing option", () => {
    const res = addAiSlots({ ...base, ranges: [{ start: at("2026-10-27T13:00"), end: at("2026-10-27T14:00") }] });
    expect(res.skipped[0].why).toBe("duplicate");
  });

  it("stops at the cap of 3 per poll", () => {
    const ranges = ["26", "28", "29", "30"].map((d) => ({
      start: at(`2026-10-${d}T13:00`),
      end: at(`2026-10-${d}T15:00`),
    }));
    const res = addAiSlots({ ...base, aiAddedSoFar: 1, ranges });
    expect(res.added).toHaveLength(2);
    expect(res.skipped.filter((s) => s.why === "cap")).toHaveLength(2);
  });

  it("never adds a slot outside reasonable hours", () => {
    const res = addAiSlots({
      ...base,
      rules: rules({ workingHours: { start: "00:00", end: "23:45" } }),
      ranges: [{ start: at("2026-10-28T21:30"), end: at("2026-10-28T23:30") }],
    });
    expect(res.added).toEqual([]);
  });
});

describe("overlapsClock", () => {
  it("catches a partial overlap off the 15-minute grid", () => {
    const noon = { start: at("2026-10-26T12:00"), end: at("2026-10-26T13:00") };
    expect(overlapsClock(noon, { start: "12:50", end: "14:00" }, NY)).toBe(true);
    expect(overlapsClock(noon, { start: "13:00", end: "14:00" }, NY)).toBe(false);
  });

  it("handles night ranges that cross midnight", () => {
    const late = { start: at("2026-10-26T20:30"), end: at("2026-10-26T21:30") };
    expect(overlapsClock(late, { start: "21:00", end: "06:00" }, NY)).toBe(true);
    const early = { start: at("2026-10-26T05:30"), end: at("2026-10-26T06:30") };
    expect(overlapsClock(early, { start: "21:00", end: "06:00" }, NY)).toBe(true);
    const day = { start: at("2026-10-26T10:00"), end: at("2026-10-26T11:00") };
    expect(overlapsClock(day, { start: "21:00", end: "06:00" }, NY)).toBe(false);
  });
});

describe("insideClock", () => {
  it("understands ranges that cross midnight", () => {
    const late = { start: at("2026-10-26T22:00"), end: at("2026-10-26T23:00") };
    expect(insideClock(late, { start: "21:00", end: "06:00" }, NY)).toBe(true);
    expect(insideClock(late, { start: "08:00", end: "21:00" }, NY)).toBe(false);
  });
});
