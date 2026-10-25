import { z } from "zod";
import { isValidZone } from "@/lib/engine/time";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:mm, 24-hour");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use yyyy-MM-dd");
const zone = z.string().refine(isValidZone, "use an IANA timezone like Europe/London");
const clockRange = z.object({ start: clock, end: clock });

export const timeOfDay = z.enum(["morning", "afternoon", "evening", "night"]);

export const constraintSchema = z.object({
  appliesTo: z.string().min(1).describe('a person\'s name, "organizer", or "everyone"'),
  type: z.enum(["avoid", "prefer"]),
  strength: z.enum(["hard", "soft"]),
  days: z
    .array(z.literal([1, 2, 3, 4, 5, 6, 7]))
    .nullish()
    .describe("ISO weekdays: 1 = Monday … 7 = Sunday"),
  timeOfDay: timeOfDay.nullish(),
  between: clockRange.nullish().describe("exact clock times, in that person's timezone"),
  weight: z.union([z.literal(1), z.literal(2)]).nullish().describe("1 mild, 2 strong"),
  description: z.string().min(1).describe("the rule in a few plain words"),
});

/** Job 1: the organizer's text → poll details. */
export const parsedPollSchema = z.object({
  title: z.string().min(1).max(120),
  people: z.array(
    z.object({
      name: z.string().min(1),
      timezone: zone.nullish(),
      hours: clockRange.nullish(),
      required: z.boolean(),
      notes: z.string().nullish(),
    }),
  ),
  expectedCount: z.number().int().min(1).max(50).nullish(),
  window: z.object({ startDate: date, endDate: date }).nullish(),
  durationMinutes: z.number().int().min(15).max(480).nullish(),
  workingHours: clockRange.nullish(),
  constraints: z.array(constraintSchema),
  reasonableHours: clockRange.nullish(),
  onlyIfNecessary: z.boolean(),
  notUnderstood: z.array(z.string()),
});
export type ParsedPoll = z.infer<typeof parsedPollSchema>;

/** Job 2: a guest's statement → proposed ranges and preferences. */
export const parsedStatementSchema = z.object({
  restatement: z.string().min(1),
  ranges: z.array(
    z.object({
      date,
      start: clock,
      end: clock,
    }),
  ),
  timezone: zone,
  preferencesSummary: z.string().nullish(),
  preferences: z.array(constraintSchema),
  ambiguous: z.array(z.string()),
});
export type ParsedStatement = z.infer<typeof parsedStatementSchema>;

/** Job 3: computed facts → sentences. */
export const explanationSchema = z.object({
  summary: z.string().min(1),
  conditional: z.array(z.string()),
  perOption: z.array(z.object({ option: z.number().int().min(1), text: z.string().min(1) })),
});
export type Explanation = z.infer<typeof explanationSchema>;
