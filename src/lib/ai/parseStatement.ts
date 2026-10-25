import { DateTime } from "luxon";
import { z } from "zod";
import type { Constraint, Interval, Weekday } from "@/lib/engine/types";
import { complete, type AiResult } from "./complete";
import { parsedStatementSchema, type ParsedStatement } from "./schemas";

const SYSTEM = `A guest is telling a group-scheduling poll when they are free, in their own words.
Turn it into JSON. You only record what they said. Code decides which times are actually added.

How to fill each field:
- restatement: one plain sentence to the guest, saying back what you understood with concrete days ("You're free Tuesday 27 and Wednesday 28 October, 12:00–17:00, and you'd rather avoid Mondays.").
- ranges: every concrete time range they said they CAN do, inside the poll's dates. Use the guest's timezone. date is yyyy-MM-dd, start and end are HH:mm (24-hour).
  "afternoons" = 12:00 to 17:00, "mornings" = 09:00 to 12:00, "evenings" = 17:00 to 21:00, "any time" or a whole day = 09:00 to 18:00, unless they give exact times.
  Expand "Tuesday or Wednesday afternoons" into one range per matching date in the poll's dates.
  If they only name a period without hours ("prefer next week", "mostly free Thursday", "anytime"), treat it as 09:00 to 18:00 on those dates and say so in the restatement, so they can correct it.
  "this week" and "next week" mean exactly the calendar weeks given in the message (Monday to Sunday), so on a Sunday "next week" starts tomorrow. If the guest clearly means something else, follow them and note it in ambiguous.
  Never return a date outside the poll's dates. If what they want falls entirely outside them, return empty ranges and say so plainly in the restatement.
- timezone: the guest's timezone as given, unless they clearly state another (BST/UK → Europe/London).
- preferencesSummary: a short line the organizer will read ("Prefers Tuesday or Wednesday afternoons; can't do Mondays"), or null.
- preferences: things to avoid or prefer, as rules about this guest (appliesTo is the guest's name). "not Mondays" → {type:"avoid", strength:"soft", days:[1], weight:2}. Use days (1 = Monday … 7 = Sunday), timeOfDay (morning, afternoon, evening, night) or between (HH:mm). strength is always "soft".
- ambiguous: short quotes of anything you were unsure about. Empty if none.

If the text says nothing about availability or preferences, return empty ranges, null preferencesSummary and put the text in ambiguous.

Reply with only a JSON object matching this JSON Schema:
${JSON.stringify(z.toJSONSchema(parsedStatementSchema))}`;

export function parseStatementPrompt(i: {
  text: string;
  today: DateTime;
  guestName: string;
  window: { startDate: string; endDate: string };
}) {
  // Code works out the calendar weeks so the model never has to count days.
  const monday = i.today.startOf("week");
  const week = (from: DateTime) => `${from.toISODate()} to ${from.plus({ days: 6 }).toISODate()}`;
  return `Today is ${i.today.toFormat("cccc yyyy-MM-dd")}. The guest's timezone is ${i.today.zoneName}. The guest's name is ${i.guestName}.
"This week" is ${week(monday)}. "Next week" is ${week(monday.plus({ weeks: 1 }))}.
The poll's dates are ${i.window.startDate} to ${i.window.endDate}.

What the guest wrote:
"""
${i.text}
"""`;
}

export type Interpretation = ParsedStatement;

export async function parseStatement(input: {
  text: string;
  timezone: string;
  guestName: string;
  window: { startDate: string; endDate: string };
  now?: number;
}): Promise<AiResult<Interpretation>> {
  const today = DateTime.fromMillis(input.now ?? Date.now(), { zone: input.timezone });
  return complete({
    job: "parseStatement",
    system: SYSTEM,
    user: parseStatementPrompt({ ...input, today }),
    schema: parsedStatementSchema,
    input: {
      text: input.text,
      today: today.toISODate(),
      timezone: input.timezone,
      guestName: input.guestName,
      window: input.window,
    },
  });
}

/** The guest's confirmed ranges as UTC intervals, in their (possibly corrected) timezone. */
export function rangesToIntervals(i: Pick<Interpretation, "ranges" | "timezone">): Interval[] {
  return i.ranges
    .map((r) => ({
      start: DateTime.fromISO(`${r.date}T${r.start}`, { zone: i.timezone }).toMillis(),
      end: DateTime.fromISO(`${r.date}T${r.end}`, { zone: i.timezone }).toMillis(),
    }))
    .filter((r) => Number.isFinite(r.start) && r.end > r.start);
}

/** Preferences as engine rules, always soft and always about this guest. */
export function toPreferences(i: Interpretation, guestName: string): Constraint[] {
  return i.preferences.map((p) => ({
    appliesTo: guestName,
    type: p.type,
    strength: "soft",
    days: (p.days ?? null) as Weekday[] | null,
    timeOfDay: p.timeOfDay ?? null,
    between: p.between ?? null,
    weight: p.weight ?? 1,
    description: p.description,
  }));
}
