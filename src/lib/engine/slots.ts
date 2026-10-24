import { config } from "@/lib/config";
import { breaksHardRule, predictedNos, softPenalties, withinReasonableHours } from "./constraints";
import { dailyBlocks, intersect, localDate, overlaps, subtract } from "./time";
import type { Interval, Penalty, PollRules, SlotOption } from "./types";

const MINUTE = 60_000;

/** The organizer's free time inside the window and their working hours. */
export function organizerFreeWindows(rules: PollRules, organizerBusy: Interval[]): Interval[] {
  const blocks = dailyBlocks(rules.window, rules.workingHours, rules.organizerTimezone);
  return subtract(blocks, organizerBusy);
}

/** Can this exact slot be offered at all? (not past, reasonable hours, meeting-wide hard rules) */
export function isAllowed(slot: Interval, rules: PollRules, now: number): boolean {
  return slot.start >= now && withinReasonableHours(slot, rules) && !breaksHardRule(slot, rules);
}

/** Every allowed meeting-length slot inside the given free windows. */
export function slotsWithin(free: Interval[], rules: PollRules, now: number): Interval[] {
  const step = config.slotStepMinutes * MINUTE;
  const length = rules.durationMinutes * MINUTE;
  const out: Interval[] = [];
  for (const f of free) {
    for (let t = Math.ceil(f.start / step) * step; t + length <= f.end; t += step) {
      const slot = { start: t, end: t + length };
      if (isAllowed(slot, rules, now)) out.push(slot);
    }
  }
  return out;
}

/**
 * Slide the meeting length across the organizer's free time in 15-minute
 * steps, keeping only slots that suit everyone's reasonable hours and the hard
 * rules. Computed when needed, never stored.
 */
export function buildCandidatePool(
  rules: PollRules,
  organizerBusy: Interval[],
  now: number,
): Interval[] {
  return slotsWithin(organizerFreeWindows(rules, organizerBusy), rules, now);
}

/** What the organizer's own text says about a slot, before anyone answers. */
export function rulePenalties(slot: Interval, rules: PollRules): Penalty[] {
  const nos = predictedNos(slot, rules).map(({ person, reason }) => ({
    reason,
    person: person.name,
    points: person.required ? config.weights.requiredNo : config.weights.no,
  }));
  return [...nos, ...softPenalties(slot, rules.constraints, rules)];
}

export function ruleScore(slot: Interval, rules: PollRules): number {
  return rulePenalties(slot, rules).reduce((sum, p) => sum + p.points, 0);
}

/**
 * Pick a short list from the pool: best soft score first, spread across days,
 * never overlapping each other. Ties go to the earlier time.
 */
export function chooseInitialOptions(
  pool: Interval[],
  rules: PollRules,
  count: number = config.initialOptionCount,
): Interval[] {
  const base = pool.map((slot) => ({ slot, score: ruleScore(slot, rules) }));
  const chosen: Interval[] = [];
  const perDay = new Map<string, number>();
  while (chosen.length < count) {
    let best: { slot: Interval; total: number } | null = null;
    for (const { slot, score } of base) {
      if (chosen.some((c) => overlaps(c, slot))) continue;
      const day = localDate(slot.start, rules.organizerTimezone);
      const total = score + (perDay.get(day) ?? 0) * config.weights.sameDay;
      if (!best || total < best.total || (total === best.total && slot.start < best.slot.start)) {
        best = { slot, total };
      }
    }
    if (!best) break;
    chosen.push(best.slot);
    const day = localDate(best.slot.start, rules.organizerTimezone);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return chosen.sort((a, b) => a.start - b.start);
}

export type AddResult = {
  added: Interval[];
  skipped: { range: Interval; why: "busy" | "duplicate" | "cap" }[];
};

/**
 * Turn proposed ranges (from a guest's statement or calendar) into new slots:
 * only where the organizer is free, never duplicating an existing option, and
 * never past the cap. Code enforces all three; the model only proposed ranges.
 */
export function addAiSlots(input: {
  ranges: Interval[];
  rules: PollRules;
  organizerBusy: Interval[];
  existing: SlotOption[];
  aiAddedSoFar: number;
  now: number;
  cap?: number;
}): AddResult {
  const cap = input.cap ?? config.aiSlotCap;
  const free = organizerFreeWindows(input.rules, input.organizerBusy);
  const taken: Interval[] = [...input.existing];
  const result: AddResult = { added: [], skipped: [] };
  for (const range of input.ranges) {
    if (input.aiAddedSoFar + result.added.length >= cap) {
      result.skipped.push({ range, why: "cap" });
      continue;
    }
    const candidates = slotsWithin(intersect([range], free), input.rules, input.now);
    if (candidates.length === 0) {
      result.skipped.push({ range, why: "busy" });
      continue;
    }
    const fresh = candidates.filter((c) => !taken.some((t) => overlaps(t, c)));
    if (fresh.length === 0) {
      result.skipped.push({ range, why: "duplicate" });
      continue;
    }
    const pick = fresh.reduce((a, b) =>
      ruleScore(b, input.rules) < ruleScore(a, input.rules) ? b : a,
    );
    result.added.push(pick);
    taken.push(pick);
  }
  return result;
}
