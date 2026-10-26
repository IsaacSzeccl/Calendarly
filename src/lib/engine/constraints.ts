import { config } from "@/lib/config";
import { insideClock, localWeekday, overlapsClock, timeOfDayRange } from "./time";
import type { ClockRange, Constraint, Interval, Penalty, Person, PollRules } from "./types";

export function findPerson(name: string, rules: PollRules): Person | undefined {
  const who = name.trim().toLowerCase();
  return rules.people.find((p) => p.name.trim().toLowerCase() === who);
}

/** The timezone a rule is judged in: the named person's, else the organizer's. */
export function zoneFor(appliesTo: string, rules: PollRules): string {
  return findPerson(appliesTo, rules)?.timezone ?? rules.organizerTimezone;
}

function clockOf(c: Constraint): ClockRange | null {
  if (c.between) return c.between;
  if (c.timeOfDay) return timeOfDayRange(c.timeOfDay);
  return null;
}

function dayMatches(slot: Interval, c: Constraint, zone: string): boolean {
  if (!c.days || c.days.length === 0) return true;
  return c.days.includes(localWeekday(slot.start, zone));
}

/** True when the slot breaks the rule (lands on an avoided time, or misses a preferred one). */
export function breaks(slot: Interval, c: Constraint, zone: string): boolean {
  const clock = clockOf(c);
  if (c.type === "avoid") {
    if (!dayMatches(slot, c, zone)) return false;
    return clock ? overlapsClock(slot, clock, zone) : true;
  }
  // prefer: the slot must be on a preferred day and fully inside the preferred time.
  if (!dayMatches(slot, c, zone)) return true;
  return clock ? !insideClock(slot, clock, zone) : false;
}

/**
 * A hard rule about the organizer or the whole meeting removes the slot.
 * A hard rule about one guest ("Leo only does evenings") does not: it predicts
 * that guest's "no", so the slot can still be offered with that trade-off.
 */
export function breaksHardRule(slot: Interval, rules: PollRules): Constraint | null {
  for (const c of rules.constraints) {
    if (c.strength !== "hard" || findPerson(c.appliesTo, rules)) continue;
    if (breaks(slot, c, zoneFor(c.appliesTo, rules))) return c;
  }
  return null;
}

/** Guests the organizer's text says can't make this slot, with the reason. */
export function predictedNos(slot: Interval, rules: PollRules): { person: Person; reason: string }[] {
  const out: { person: Person; reason: string }[] = [];
  for (const p of rules.people) {
    if (p.hours && !insideClock(slot, p.hours, p.timezone)) {
      out.push({ person: p, reason: `outside ${p.name}'s hours (${p.hours.start}–${p.hours.end})` });
      continue;
    }
    const rule = rules.constraints.find(
      (c) =>
        c.strength === "hard" &&
        findPerson(c.appliesTo, rules) === p &&
        breaks(slot, c, p.timezone),
    );
    if (rule) out.push({ person: p, reason: rule.description });
  }
  return out;
}

/** Soft penalties for a slot from a list of rules, each with its reason. */
export function softPenalties(
  slot: Interval,
  constraints: Constraint[],
  rules: PollRules,
): Penalty[] {
  const out: Penalty[] = [];
  for (const c of constraints) {
    if (c.strength !== "soft") continue;
    if (!breaks(slot, c, zoneFor(c.appliesTo, rules))) continue;
    out.push({
      reason: c.description,
      points: config.weights.softConstraint * (c.weight ?? 1),
      person: findPerson(c.appliesTo, rules)?.name,
    });
  }
  return out;
}

/** Nobody is offered a time outside reasonable hours in their own timezone. */
export function withinReasonableHours(slot: Interval, rules: PollRules): boolean {
  if (!insideClock(slot, rules.reasonableHours, rules.organizerTimezone)) return false;
  return rules.people.every((p) => insideClock(slot, rules.reasonableHours, p.timezone));
}
