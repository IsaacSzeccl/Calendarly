import { DateTime } from "luxon";
import { providerFor } from "@/lib/calendar";
import type { CalendarAccount } from "@/lib/calendar/provider";
import { buildCandidatePool, chooseInitialOptions } from "@/lib/engine/slots";
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
): Promise<{ options: Interval[]; poolSize: number; organizerBusy: Interval[] }> {
  const range = windowRange(rules);
  const organizerBusy = await providerFor(organizer).getBusy(organizer, range.start, range.end);
  const pool = buildCandidatePool(rules, organizerBusy, now);
  return { options: chooseInitialOptions(pool, rules), poolSize: pool.length, organizerBusy };
}
