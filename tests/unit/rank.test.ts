import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  adviceSentences,
  basisText,
  conditionalAdvice,
  isComplete,
  labelFor,
  noClearFit,
  rank,
  statusFor,
} from "@/lib/engine/rank";
import type { Choice, PollRules, Respondent, SlotOption } from "@/lib/engine/types";

const ZONE = "Europe/London";
const at = (iso: string) => DateTime.fromISO(iso, { zone: ZONE }).toMillis();
const opt = (id: string, iso: string): SlotOption => ({
  id,
  start: at(iso),
  end: at(iso) + 3_600_000,
  source: "organizer_free",
});

// Three afternoon options, Mon–Wed.
const o1 = opt("o1", "2026-11-02T14:00");
const o2 = opt("o2", "2026-11-03T14:00");
const o3 = opt("o3", "2026-11-04T14:00");
const options = [o1, o2, o3];

function rules(over: Partial<PollRules> = {}): PollRules {
  return {
    organizerName: "Alex",
    organizerTimezone: ZONE,
    people: [
      { name: "Sam", timezone: ZONE, required: true },
      { name: "Priya", timezone: ZONE, required: false },
      { name: "Leo", timezone: ZONE, required: false },
    ],
    window: { startDate: "2026-11-02", endDate: "2026-11-06" },
    durationMinutes: 60,
    workingHours: { start: "09:00", end: "17:00" },
    constraints: [],
    reasonableHours: { start: "08:00", end: "21:00" },
    onlyIfNecessary: false,
    ...over,
  };
}

function guest(name: string, votes: Record<string, Choice>, extra: Partial<Respondent> = {}): Respondent {
  return {
    id: name.toLowerCase(),
    name,
    timezone: ZONE,
    required: false,
    votes,
    busy: null,
    preferences: [],
    hasStatement: false,
    ...extra,
  };
}

describe("statusFor", () => {
  it("uses the vote first, then a connected calendar, else unknown", () => {
    const busy = [{ start: o1.start, end: o1.end }];
    expect(statusFor(guest("A", { o1: "prefer_not" }, { busy }), o1)).toBe("prefer_not");
    expect(statusFor(guest("A", {}, { busy }), o1)).toBe("no");
    expect(statusFor(guest("A", {}, { busy }), o2)).toBe("yes");
    expect(statusFor(guest("A", {}), o2)).toBe("unknown");
  });

  it("lets an explicit yes override a busy calendar", () => {
    const busy = [{ start: o1.start, end: o1.end }];
    expect(statusFor(guest("A", { o1: "yes" }, { busy }), o1)).toBe("yes");
  });
});

describe("labelFor", () => {
  const a = (score: number, no = 0, required = 0) => ({
    score,
    cannotCome: Array(no).fill("x"),
    requiredMissing: Array(required).fill("x"),
  });

  it("maps scores to fuzzy labels", () => {
    expect(labelFor(a(0), false)).toBe("Recommended");
    expect(labelFor(a(3), false)).toBe("Works well");
    expect(labelFor(a(10, 1), false)).toBe("Works with trade-offs");
    expect(labelFor(a(30, 3), false)).toBe("Not recommended");
  });

  it("never rates a slot a required person can't make above Not recommended", () => {
    expect(labelFor(a(0, 1, 1), false)).toBe("Not recommended");
  });

  it("needs no 'no' from anyone for Recommended or Works well", () => {
    expect(labelFor(a(1, 1), false)).toBe("Works with trade-offs");
  });

  it("doesn't recommend a time someone who answered left blank", () => {
    expect(labelFor({ ...a(1), unmarked: ["Priya"] }, false)).toBe("Works well");
  });

  it("raises the bar when the organizer only wants to meet if necessary", () => {
    expect(labelFor(a(2), true)).toBe("Works well");
    expect(labelFor(a(6), true)).toBe("Works with trade-offs");
  });
});

describe("rank and conditionalAdvice (no perfect slot)", () => {
  // Sam (required) can do everything. Leo can't do option 1; Priya can't do option 3.
  // Option 2: Priya would prefer not, Leo can't.
  const respondents = [
    guest("Sam", { o1: "yes", o2: "yes", o3: "yes" }),
    guest("Priya", { o1: "yes", o2: "prefer_not", o3: "no" }),
    guest("Leo", { o1: "no", o2: "no", o3: "yes" }),
  ];
  const ranked = rank(options, { rules: rules(), respondents });

  it("orders by score with option numbers in time order", () => {
    expect(ranked.map((r) => r.number)).toEqual([1, 3, 2]);
    expect(ranked[0].label).toBe("Works with trade-offs");
    expect(ranked[0].penalties.map((p) => p.reason)).toEqual(["Leo can't make it"]);
  });

  it("gives conditional advice computed by code", () => {
    const advice = conditionalAdvice(ranked, 4);
    expect(advice.noPerfectSlot).toBe(true);
    expect(advice.best).toMatchObject({ number: 1, leavesOut: ["Leo"], worksFor: 3, outOf: 4 });
    expect(advice.ifRequired).toEqual([{ person: "Leo", optionId: "o3", number: 3, leavesOut: ["Priya"] }]);
    expect(adviceSentences(advice)).toEqual([
      "If Leo must be there, choose option 3 (it leaves out Priya).",
      "Otherwise option 1 works for 3 of 4, without Leo.",
    ]);
  });

  it("lets a required person's no dominate the ranking", () => {
    const withSamNo = [
      guest("Sam", { o1: "no", o2: "yes", o3: "yes" }),
      guest("Priya", { o1: "yes", o2: "no", o3: "no" }),
      guest("Leo", { o1: "yes", o2: "no", o3: "no" }),
    ];
    const r = rank(options, { rules: rules(), respondents: withSamNo });
    const one = r.find((x) => x.number === 1)!;
    expect(one.label).toBe("Not recommended");
    expect(r[r.length - 1].number).toBe(1);
  });

  it("gives no advice when one option suits everyone", () => {
    const happy = [guest("Sam", { o1: "yes" }), guest("Priya", { o1: "yes" }), guest("Leo", { o1: "yes" })];
    const r = rank(options, { rules: rules(), respondents: happy });
    expect(r[0].label).toBe("Recommended");
    expect(conditionalAdvice(r, 4).noPerfectSlot).toBe(false);
    expect(adviceSentences(conditionalAdvice(r, 4))).toEqual([]);
  });
});

describe("blanks from people who answered", () => {
  it("cost a little, so a fully answered time ranks higher", () => {
    const r = rank([o1, o2], {
      rules: rules({ people: [] }),
      respondents: [guest("Priya", { o2: "yes" })],
    });
    expect(r[0].number).toBe(2);
    expect(r[1].unmarked).toEqual(["Priya"]);
    expect(r[1].penalties).toEqual([{ reason: "Priya left this time blank", points: 1, person: "Priya" }]);
  });
});

describe("people who haven't answered", () => {
  it("counts the organizer's hard rule about them as a predicted no", () => {
    const r = rank([o1], {
      rules: rules({
        constraints: [
          { appliesTo: "Leo", type: "prefer", strength: "hard", timeOfDay: "evening", description: "only does evenings" },
        ],
      }),
      respondents: [guest("Sam", { o1: "yes" })],
    });
    expect(r[0].cannotCome).toEqual(["Leo"]);
    expect(r[0].unknown).toEqual(["Priya"]);
    expect(r[0].penalties[0].reason).toBe("Leo probably can't (only does evenings)");
  });

  it("lets their own vote replace the prediction once they answer", () => {
    const r = rank([o1], {
      rules: rules({
        constraints: [
          { appliesTo: "Leo", type: "prefer", strength: "hard", timeOfDay: "evening", description: "only does evenings" },
        ],
      }),
      respondents: [guest("Leo", { o1: "yes" })],
    });
    expect(r[0].cannotCome).toEqual([]);
  });
});

describe("soft preferences from a guest's statement", () => {
  it("add a small penalty, judged in the guest's timezone", () => {
    const priya = guest(
      "Priya",
      { o1: "yes", o2: "yes" },
      {
        preferences: [
          { appliesTo: "Priya", type: "avoid", strength: "soft", days: [1], description: "Priya would rather avoid Mondays" },
        ],
      },
    );
    const r = rank([o1, o2], { rules: rules({ people: [] }), respondents: [priya] });
    expect(r[0].number).toBe(2);
    expect(r[1].penalties).toContainEqual(
      expect.objectContaining({ reason: "Priya would rather avoid Mondays", points: 2 }),
    );
  });
});

describe("onlyIfNecessary", () => {
  it("says nothing is a clear fit when no option reaches Works well", () => {
    const r = rank(options, {
      rules: rules({ onlyIfNecessary: true }),
      respondents: [guest("Priya", { o1: "no", o2: "no", o3: "no" })],
    });
    expect(noClearFit(r, true)).toBe(true);
  });
});

describe("isComplete and basisText", () => {
  it("counts the organizer as answered", () => {
    expect(isComplete(3, 6)).toEqual({ responded: 4, expected: 6, complete: false, text: "4 of 6" });
    expect(isComplete(5, 6).complete).toBe(true);
  });

  it("builds the basis line from counts", () => {
    expect(basisText({ connectedCalendars: 2, sampleCalendars: 0, voters: 2, statements: 1 })).toBe(
      "based on 2 connected calendars, 2 people's votes and 1 stated availability",
    );
    expect(basisText({ connectedCalendars: 0, sampleCalendars: 1, voters: 1, statements: 0 })).toBe(
      "based on 1 sample calendar and 1 person's votes",
    );
    expect(basisText({ connectedCalendars: 0, sampleCalendars: 0, voters: 0, statements: 0 })).toBe(
      "based on no answers yet",
    );
  });
});
