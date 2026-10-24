// Golden cases for job 1 (parsePoll). Recorded answers by default; LIVE=1 calls the real model.
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { parsePoll } from "@/lib/ai/parsePoll";

const live = process.env.LIVE === "1";
const timeout = live ? 90_000 : 5_000;

async function run(text: string, timezone: string) {
  const res = await parsePoll({ text, timezone });
  if (!res.ok) throw new Error(`parsePoll failed: ${res.error}`);
  return res.data;
}

const person = (draft: Awaited<ReturnType<typeof run>>, name: string) =>
  draft.rules.people.find((p) => p.name.toLowerCase() === name.toLowerCase());

describe(`parsePoll golden cases (${live ? "LIVE model" : "recorded answers"})`, () => {
  it(
    "Tom and Jamie: people, Jamie in London 9–6, office hours, afternoons, Tom avoids nights",
    async () => {
      const d = await run(
        "I want to meet with Tom and Jamie this week about our upcoming collaboration. Best to be afternoon meetings. Tom does not like meetings at night. My office hours are 9-5pm. Jamie works in the BST timezone 9-6pm.",
        "America/New_York",
      );
      expect(person(d, "Tom")).toBeDefined();
      expect(person(d, "Jamie")?.timezone).toBe("Europe/London");
      expect(person(d, "Jamie")?.hours).toEqual({ start: "09:00", end: "18:00" });
      expect(d.rules.workingHours).toEqual({ start: "09:00", end: "17:00" });
      expect(d.expectedCount).toBe(3);
      expect(d.rules.constraints).toContainEqual(
        expect.objectContaining({ type: "prefer", strength: "soft", timeOfDay: "afternoon" }),
      );
      expect(d.rules.constraints).toContainEqual(
        expect.objectContaining({ appliesTo: "Tom", type: "avoid", strength: "soft", timeOfDay: "night" }),
      );
      const today = DateTime.now().setZone("America/New_York").toISODate()!;
      expect(d.rules.window.startDate >= today).toBe(true);
    },
    timeout,
  );

  it(
    "Group project: Sam required, 6 people, two hours, Leo only evenings, no Tuesdays",
    async () => {
      const d = await run(
        "I need a two-hour meeting this week with five other students about our group project: Sam, Priya, Leo, Mei and Jordan. Afternoons are best, and Sam has to be there. Leo only does evenings because of work, and I can't do Tuesdays.",
        "Asia/Hong_Kong",
      );
      expect(d.rules.people).toHaveLength(5);
      expect(person(d, "Sam")?.required).toBe(true);
      expect(person(d, "Priya")?.required).toBe(false);
      expect(d.expectedCount).toBe(6);
      expect(d.rules.durationMinutes).toBe(120);
      expect(d.rules.constraints).toContainEqual(
        expect.objectContaining({ appliesTo: "Leo", strength: "hard", timeOfDay: "evening" }),
      );
      expect(d.rules.constraints).toContainEqual(
        expect.objectContaining({ type: "avoid", strength: "hard", days: [2] }),
      );
    },
    timeout,
  );

  it(
    "Only if necessary: sets the higher bar and keeps it under 90 minutes",
    async () => {
      const d = await run(
        "Let's catch up sometime next week, only if absolutely necessary. Keep it under 90 minutes.",
        "Europe/London",
      );
      expect(d.rules.onlyIfNecessary).toBe(true);
      expect(d.rules.durationMinutes).toBeLessThanOrEqual(90);
    },
    timeout,
  );

  it.skipIf(live)("Unreadable input fails plainly after one retry", async () => {
    const res = await parsePoll({ text: "zzzz qqqq", timezone: "Europe/London" });
    expect(res.ok).toBe(false);
    expect(res.runs).toHaveLength(2);
  });
});
