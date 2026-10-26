import { DateTime } from "luxon";
import { providerFor } from "@/lib/calendar";
import type { CalendarAccount } from "@/lib/calendar/provider";
import { config } from "@/lib/config";
import { buildCandidatePool, chooseInitialOptions } from "@/lib/engine/slots";
import { overlaps } from "@/lib/engine/time";
import type { Interval, PollRules } from "@/lib/engine/types";

/** The window as UTC milliseconds: from the first day's midnight to the last day's end. */
export function windowRange(rules: PollRules): Interval {
  const zone = rules.organizerTimezone;
  return {
    start: DateTime.fromISO(rules.window.startDate, { zone }).startOf("day").toMillis(),
    end: DateTime.fromISO(rules.window.endDate, { zone }).endOf("day").toMillis(),
  };
}

/** Ask the organizer's calendar when they're busy, then let the engine pick first options. */
export async function previewOptions(
  rules: PollRules,
  organizer: CalendarAccount,
  now: number = Date.now(),
  /** Meet again: busy times of the people coming along, so times they're free come first. */
  othersBusy: Interval[][] = [],
): Promise<{ options: Interval[]; poolSize: number; organizerBusy: Interval[] }> {
  const range = windowRange(rules);
  const organizerBusy = await providerFor(organizer).getBusy(organizer, range.start, range.end);
  const pool = buildCandidatePool(rules, organizerBusy, now);
  const othersCant = (slot: Interval) =>
    othersBusy.filter((busy) => busy.some((b) => overlaps(b, slot))).length * config.weights.no;
  return { options: chooseInitialOptions(pool, rules, undefined, othersCant), poolSize: pool.length, organizerBusy };
}
