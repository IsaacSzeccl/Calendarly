import { z } from "zod";
import { constraintSchema } from "@/lib/ai/schemas";
import { isValidZone } from "@/lib/engine/time";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const zone = z.string().refine(isValidZone, "unknown timezone");
const clockRange = z.object({ start: clock, end: clock });

/** Rules as edited by the organizer in the browser. Checked again on the server. */
export const pollRulesSchema = z.object({
  organizerName: z.string().min(1).max(80),
  organizerTimezone: zone,
  people: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        timezone: zone,
        required: z.boolean(),
        hours: clockRange.nullish(),
        notes: z.string().max(300).nullish(),
      }),
    )
    .max(30),
  window: z
    .object({ startDate: date, endDate: date })
    .refine((w) => w.endDate >= w.startDate, "the end date is before the start date"),
  durationMinutes: z.number().int().min(15).max(480),
  workingHours: clockRange,
  constraints: z.array(constraintSchema).max(40),
  reasonableHours: clockRange,
  onlyIfNecessary: z.boolean(),
});

export const draftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  expectedCount: z.number().int().min(1).max(50),
  notUnderstood: z.array(z.string()).default([]),
  rules: pollRulesSchema,
});
