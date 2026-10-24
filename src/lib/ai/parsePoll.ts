import { DateTime } from "luxon";
import { z } from "zod";
import { config } from "@/lib/config";
import type { Constraint, PollRules, Weekday } from "@/lib/engine/types";
import { complete, type AiResult } from "./complete";
import { parsedPollSchema, type ParsedPoll } from "./schemas";

/** A poll as the organizer will see it in the editable summary. */
export type PollDraft = {
  title: string;
  expectedCount: number;
  notUnderstood: string[];
  rules: PollRules;
};

const SYSTEM = `You read an organizer's plain-language meeting request and write it down as JSON for a scheduling app.
You only record what was said. Code does all the scheduling, so never invent times, people or rules.

How to fill each field:
- title: a short meeting title from the request.
- people: everyone named or described other than the organizer ("Tom", "the coach"). Do not list the organizer.
  - timezone: an IANA name when a timezone or place is stated (BST, GMT or UK → "Europe/London"; EST/ET → "America/New_York"; HKT → "Asia/Hong_Kong"), otherwise null.
  - hours: the hours that person works or can meet, in their own timezone, when stated ("works 9-6pm" → 09:00 to 18:00). Otherwise null.
  - required: true only if the text says they must attend ("Sam has to be there").
  - notes: anything else said about them, in a few words, or null.
- expectedCount: how many people will be in the meeting INCLUDING the organizer ("with five other students" → 6; "with Tom and Jamie" → 3). null if unclear.
- window: inclusive dates in the organizer's timezone, yyyy-MM-dd. "this week" = today until this Sunday, but if today is Saturday or Sunday use the coming Monday to Friday. "next week" = next Monday to Sunday. null if no dates are given. Never before today.
- durationMinutes: when a length is stated ("two-hour" → 120), else null.
- workingHours: the organizer's own hours when stated ("my office hours are 9-5pm" → 09:00 to 17:00), else null.
- constraints: one entry per preference or restriction, from the organizer or about anyone else.
  - appliesTo: the person's name, "organizer", or "everyone" for the meeting as a whole.
  - type "avoid" for times to stay away from; "prefer" for times wanted.
  - strength "hard" for can't / never / only / must; "soft" for prefer / best / doesn't like / hates.
  - Use days (1 = Monday … 7 = Sunday), timeOfDay (morning 06-12, afternoon 12-17, evening 17-21, night 21-06) or between (exact HH:mm in that person's timezone).
  - weight 2 for strong feelings ("hates"), else 1.
  - Do not repeat a person's working hours here; those go in people[].hours.
  Examples: "Best to be afternoon meetings" → {appliesTo:"everyone", type:"prefer", strength:"soft", timeOfDay:"afternoon"}.
  "Tom does not like meetings at night" → {appliesTo:"Tom", type:"avoid", strength:"soft", timeOfDay:"night"}.
  "the coach can't do Tuesdays" → {appliesTo:"coach", type:"avoid", strength:"hard", days:[2]}.
  "Tom only does evenings" → {appliesTo:"Tom", type:"prefer", strength:"hard", timeOfDay:"evening"}.
- reasonableHours: only if the text explicitly allows unusual hours ("a late evening call is fine" → 08:00 to 23:00), else null.
- onlyIfNecessary: true only if they say they only want to meet if absolutely necessary.
- notUnderstood: short quotes of anything you could not represent. Empty if none.

Reply with only a JSON object matching this JSON Schema:
${JSON.stringify(z.toJSONSchema(parsedPollSchema))}`;

export function parsePollPrompt(text: string, today: DateTime) {
  return `Today is ${today.toFormat("cccc yyyy-MM-dd")}. The organizer's timezone is ${today.zoneName}.

Request:
"""
${text}
"""`;
}

export async function parsePoll(input: {
  text: string;
  timezone: string;
  now?: number;
  organizerName?: string;
}): Promise<AiResult<PollDraft>> {
  const today = DateTime.fromMillis(input.now ?? Date.now(), { zone: input.timezone });
  const result = await complete({
    job: "parsePoll",
    system: SYSTEM,
    user: parsePollPrompt(input.text, today),
    schema: parsedPollSchema,
    input: { text: input.text, today: today.toISODate(), timezone: input.timezone },
  });
  if (!result.ok) return result;
  return {
    ok: true,
    runs: result.runs,
    data: toDraft(result.data, today, input.organizerName ?? "You"),
  };
}

/** Fill defaults and clamp what the model said into rules the engine can trust. */
export function toDraft(parsed: ParsedPoll, today: DateTime, organizerName: string): PollDraft {
  const zone = today.zoneName!;
  const todayIso = today.toISODate()!;
  let startDate = parsed.window?.startDate ?? todayIso;
  if (startDate < todayIso) startDate = todayIso;
  let endDate =
    parsed.window?.endDate ?? today.plus({ days: config.defaultWindowDays - 1 }).toISODate()!;
  const maxEnd = DateTime.fromISO(startDate, { zone }).plus({ days: 20 }).toISODate()!;
  if (endDate < startDate) endDate = startDate;
  if (endDate > maxEnd) endDate = maxEnd;

  const people = parsed.people.map((p) => ({
    name: p.name.trim(),
    timezone: p.timezone ?? zone,
    required: p.required,
    hours: p.hours ?? null,
    notes: p.notes ?? null,
  }));

  const constraints: Constraint[] = parsed.constraints.map((c) => ({
    appliesTo: c.appliesTo,
    type: c.type,
    strength: c.strength,
    days: (c.days ?? null) as Weekday[] | null,
    timeOfDay: c.timeOfDay ?? null,
    between: c.between ?? null,
    weight: c.weight ?? 1,
    description: c.description,
  }));

  return {
    title: parsed.title,
    expectedCount: parsed.expectedCount ?? people.length + 1,
    notUnderstood: parsed.notUnderstood,
    rules: {
      organizerName,
      organizerTimezone: zone,
      people,
      window: { startDate, endDate },
      durationMinutes: parsed.durationMinutes ?? config.defaultDurationMinutes,
      workingHours: parsed.workingHours ?? config.defaultWorkingHours,
      constraints,
      reasonableHours: parsed.reasonableHours ?? config.reasonableHours,
      onlyIfNecessary: parsed.onlyIfNecessary,
    },
  };
}
