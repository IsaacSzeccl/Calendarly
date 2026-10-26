import { config } from "@/lib/config";
import { listNames as list } from "@/lib/format";
import { findPerson, predictedNos, softPenalties } from "./constraints";
import { overlaps } from "./time";
import type {
  Label,
  Penalty,
  Person,
  PollRules,
  Respondent,
  SlotOption,
  Status,
} from "./types";

/** One person's mark on one option: an explicit vote wins over a connected calendar. */
export function statusFor(r: Respondent, option: SlotOption): Status {
  const vote = r.votes[option.id];
  if (vote) return vote;
  if (r.busy) return r.busy.some((b) => overlaps(b, option)) ? "no" : "yes";
  return "unknown";
}

export type Assessment = {
  option: SlotOption;
  /** Option number in time order, as people see it ("option 2"). */
  number: number;
  statuses: Record<string, Status>;
  penalties: Penalty[];
  score: number;
  label: Label;
  canCome: string[];
  preferNot: string[];
  cannotCome: string[];
  unknown: string[];
  /** Answered the poll but left this time blank. */
  unmarked: string[];
  /** The part of the score that comes only from those blanks. */
  blankPoints: number;
  requiredMissing: string[];
};

export type RankContext = {
  rules: PollRules;
  respondents: Respondent[];
};

/** Listed people who haven't answered yet: the organizer's text is all we know about them. */
function waitingPeople(ctx: RankContext): Person[] {
  const answered = new Set(ctx.respondents.map((r) => r.name.trim().toLowerCase()));
  return ctx.rules.people.filter((p) => !answered.has(p.name.trim().toLowerCase()));
}

export function isRequired(name: string, rules: PollRules): boolean {
  return findPerson(name, rules)?.required ?? false;
}

/** Rules where every respondent is a known person in their own timezone. */
function rulesWithRespondents(ctx: RankContext): PollRules {
  const people = ctx.rules.people.map((p) => {
    const r = ctx.respondents.find((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    return r ? { ...p, timezone: r.timezone } : p;
  });
  for (const r of ctx.respondents) {
    if (!people.some((p) => p.name.trim().toLowerCase() === r.name.trim().toLowerCase())) {
      people.push({ name: r.name, timezone: r.timezone, required: false });
    }
  }
  return { ...ctx.rules, people };
}

/**
 * Add up named penalties so a score always comes with its reasons.
 * A required person's "no" is very large, so it dominates everything else.
 */
export function scoreSlot(option: SlotOption, ctx: RankContext): Omit<Assessment, "number" | "label"> {
  const rules = rulesWithRespondents(ctx);
  const penalties: Penalty[] = [];
  const statuses: Record<string, Status> = {};
  const canCome: string[] = [];
  const preferNot: string[] = [];
  const cannotCome: string[] = [];
  const unknown: string[] = [];
  const unmarked: string[] = [];
  const requiredMissing: string[] = [];

  for (const r of ctx.respondents) {
    const s = statusFor(r, option);
    statuses[r.id] = s;
    const required = isRequired(r.name, rules);
    if (s === "no") {
      cannotCome.push(r.name);
      if (required) requiredMissing.push(r.name);
      penalties.push({
        reason: required ? `${r.name} must attend but can't make it` : `${r.name} can't make it`,
        points: required ? config.weights.requiredNo : config.weights.no,
        person: r.name,
      });
    } else if (s === "prefer_not") {
      preferNot.push(r.name);
      penalties.push({ reason: `${r.name} would prefer not`, points: config.weights.preferNot, person: r.name });
    } else if (s === "yes") {
      canCome.push(r.name);
    } else {
      unknown.push(r.name);
      unmarked.push(r.name);
      penalties.push({
        reason: required ? `${r.name} must attend but left this time blank` : `${r.name} left this time blank`,
        points: required ? config.weights.requiredUnmarked : config.weights.unmarked,
        person: r.name,
      });
    }
    if (r.preferences.length) penalties.push(...softPenalties(option, r.preferences, rules));
  }

  // People who haven't answered: only what the organizer told us.
  const waiting = new Set(waitingPeople(ctx).map((p) => p.name));
  for (const { person, reason } of predictedNos(option, rules)) {
    if (!waiting.has(person.name)) continue;
    cannotCome.push(person.name);
    if (person.required) requiredMissing.push(person.name);
    penalties.push({
      reason: `${person.name} probably can't (${reason})`,
      points: person.required ? config.weights.requiredNo : config.weights.no,
      person: person.name,
    });
  }
  for (const name of waiting) if (!cannotCome.includes(name)) unknown.push(name);

  penalties.push(...softPenalties(option, ctx.rules.constraints, rules));
  const score = penalties.reduce((sum, p) => sum + p.points, 0);
  const blankPoints = unmarked.reduce(
    (sum, name) => sum + (isRequired(name, rules) ? config.weights.requiredUnmarked : config.weights.unmarked),
    0,
  );
  return {
    option,
    statuses,
    penalties,
    score,
    canCome,
    preferNot,
    cannotCome,
    unknown,
    unmarked,
    blankPoints,
    requiredMissing,
  };
}

/**
 * Turn a score into the fuzzy label people see. Rules override bands:
 * a required person's "no" is always Not recommended, Recommended or
 * Works well need no "no" from anyone, Recommended also needs no blanks
 * from people who answered, and blanks alone never make a time Not recommended.
 */
export function labelFor(
  a: Pick<Assessment, "score" | "cannotCome" | "requiredMissing"> & { unmarked?: string[]; blankPoints?: number },
  onlyIfNecessary: boolean,
): Label {
  if (a.requiredMissing.length > 0) return "Not recommended";
  const bands = onlyIfNecessary
    ? { recommended: config.labelBands.recommended / 2, worksWell: config.labelBands.worksWell / 2 }
    : config.labelBands;
  const anyNo = a.cannotCome.length > 0;
  const blanks = (a.unmarked?.length ?? 0) > 0;
  if (!anyNo && !blanks && a.score <= bands.recommended) return "Recommended";
  if (!anyNo && a.score <= bands.worksWell) return "Works well";
  // Blanks are unknowns, not refusals: on their own they never make a time "Not recommended".
  if (a.score <= config.labelBands.tradeOffs) return "Works with trade-offs";
  if (!anyNo && a.score - (a.blankPoints ?? 0) <= config.labelBands.tradeOffs) return "Works with trade-offs";
  return "Not recommended";
}

/** Score every shown option and order them best first. Ties go to the earlier time. */
export function rank(options: SlotOption[], ctx: RankContext): Assessment[] {
  const numbered = [...options].sort((a, b) => a.start - b.start);
  return numbered
    .map((option, i) => {
      const s = scoreSlot(option, ctx);
      return { ...s, number: i + 1, label: labelFor(s, ctx.rules.onlyIfNecessary) };
    })
    .sort((a, b) => a.score - b.score || a.option.start - b.option.start);
}

/** "Nothing here is a clear fit": nothing reached Works well under the higher bar. */
export function noClearFit(ranked: Assessment[], onlyIfNecessary: boolean): boolean {
  return onlyIfNecessary && !ranked.some((a) => a.label === "Recommended" || a.label === "Works well");
}

export type Advice = {
  best: { optionId: string; number: number; leavesOut: string[]; worksFor: number; outOf: number } | null;
  /** For each person the best option leaves out: the best option if they had to be there. */
  ifRequired: {
    person: string;
    optionId: string | null;
    number: number | null;
    leavesOut: string[];
  }[];
  noPerfectSlot: boolean;
};

/**
 * Work out, in code, "if Sam must be there, option 2; otherwise option 1",
 * so the model only has to phrase it, never guess it.
 */
export function conditionalAdvice(ranked: Assessment[], peopleCounted: number): Advice {
  const top = ranked[0];
  if (!top) return { best: null, ifRequired: [], noPerfectSlot: false };
  const best = {
    optionId: top.option.id,
    number: top.number,
    leavesOut: top.cannotCome,
    worksFor: peopleCounted - top.cannotCome.length,
    outOf: peopleCounted,
  };
  const ifRequired = top.cannotCome
    .filter((p) => !top.requiredMissing.includes(p))
    .map((person) => {
      const alt = ranked.find((a) => !a.cannotCome.includes(person));
      return {
        person,
        optionId: alt?.option.id ?? null,
        number: alt?.number ?? null,
        leavesOut: alt?.cannotCome ?? [],
      };
    });
  return { best, ifRequired, noPerfectSlot: top.cannotCome.length > 0 };
}

/** Plain sentences for the advice, used as-is if the model is unavailable. */
export function adviceSentences(advice: Advice): string[] {
  if (!advice.best || !advice.noPerfectSlot) return [];
  const out = advice.ifRequired.map((alt) =>
    alt.number === null
      ? `No option works for ${alt.person}.`
      : `If ${alt.person} must be there, choose option ${alt.number}${
          alt.leavesOut.length ? ` (it leaves out ${list(alt.leavesOut)})` : ""
        }.`,
  );
  out.push(
    `Otherwise option ${advice.best.number} works for ${advice.best.worksFor} of ${advice.best.outOf}, without ${list(advice.best.leavesOut)}.`,
  );
  return out;
}

export type Completion = { responded: number; expected: number; complete: boolean; text: string };

/** "4 of 6": the organizer counts as answered, since their calendar is connected. */
export function isComplete(guestsAnswered: number, expected: number): Completion {
  const responded = guestsAnswered + 1;
  return { responded, expected, complete: responded >= expected, text: `${responded} of ${expected}` };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The "based on …" line, built from counts so the basis is never invented. */
export function basisText(counts: {
  connectedCalendars: number;
  sampleCalendars: number;
  voters: number;
  statements: number;
}): string {
  const parts: string[] = [];
  if (counts.connectedCalendars) parts.push(plural(counts.connectedCalendars, "connected calendar", "connected calendars"));
  if (counts.sampleCalendars) parts.push(plural(counts.sampleCalendars, "sample calendar", "sample calendars"));
  if (counts.voters) parts.push(plural(counts.voters, "person's votes", "people's votes"));
  if (counts.statements) parts.push(plural(counts.statements, "stated availability", "stated availabilities"));
  if (parts.length === 0) return "based on no answers yet";
  const last = parts.pop()!;
  return `based on ${parts.length ? `${parts.join(", ")} and ${last}` : last}`;
}
