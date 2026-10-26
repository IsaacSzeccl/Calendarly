// Golden case for job 3 (explain): the "no perfect slot" note. LIVE=1 calls the real model.
import { describe, expect, it } from "vitest";
import { explain, faithful } from "@/lib/ai/explain";
import { fallbackExplanation, type ExplainFacts } from "@/lib/ai/explainText";

const live = process.env.LIVE === "1";

const facts: ExplainFacts = {
  title: "Group project meeting",
  organizerName: "Alex",
  onlyIfNecessary: false,
  noClearFit: false,
  noPerfectSlot: true,
  basis: "based on 1 connected calendar and 5 people's votes",
  options: [
    {
      id: "o1",
      number: 1,
      when: "Mon 2 Nov, 14:00–16:00",
      label: "Works with trade-offs",
      canCome: ["Sam", "Priya", "Mei", "Jordan"],
      preferNot: [],
      cannotCome: ["Leo"],
      notAnswered: [],
      reasons: ["Leo can't make it"],
    },
    {
      id: "o3",
      number: 3,
      when: "Wed 4 Nov, 17:00–19:00",
      label: "Works with trade-offs",
      canCome: ["Sam", "Leo", "Mei", "Jordan"],
      preferNot: ["Mei"],
      cannotCome: ["Priya"],
      notAnswered: [],
      reasons: ["Priya can't make it", "Mei would prefer not"],
    },
    {
      id: "o2",
      number: 2,
      when: "Tue 3 Nov, 10:00–12:00",
      label: "Not recommended",
      canCome: ["Priya", "Leo"],
      preferNot: [],
      cannotCome: ["Sam", "Mei"],
      notAnswered: ["Jordan"],
      reasons: ["Sam must attend but can't make it", "Mei can't make it"],
    },
  ],
  advice: [
    "If Leo must be there, choose option 3 (it leaves out Priya).",
    "Otherwise option 1 works for 5 of 6, without Leo.",
  ],
};

describe(`explain golden case (${live ? "LIVE model" : "fallback note"})`, () => {
  it(
    "names the trade-off, keeps code's advice, covers every option",
    async () => {
      const { explanation, source } = await explain(facts);
      if (live) expect(source).toBe("model");
      expect(faithful(explanation, facts)).toBe(true);
      const note = [explanation.summary, ...explanation.conditional].join(" ");
      expect(note).toMatch(/option 1/i);
      expect(note).toMatch(/option 3/i);
      expect(note).toMatch(/Leo/);
      expect(explanation.perOption.map((p) => p.option).sort()).toEqual([1, 2, 3]);
    },
    live ? 90_000 : 5_000,
  );
});

describe("faithful", () => {
  const good = fallbackExplanation(facts);

  it("accepts the code-written note", () => {
    expect(faithful(good, facts)).toBe(true);
  });

  it("rejects a note that skips an option", () => {
    expect(faithful({ ...good, perOption: good.perOption.slice(1) }, facts)).toBe(false);
  });

  it("rejects an invented option number", () => {
    expect(faithful({ ...good, summary: "Go with option 7." }, facts)).toBe(false);
  });

  it("rejects percentages and scores", () => {
    expect(faithful({ ...good, summary: "Option 1 is a 92% match." }, facts)).toBe(false);
  });

  it("rejects dropping the conditional advice", () => {
    expect(faithful({ ...good, conditional: [] }, facts)).toBe(false);
  });
});
