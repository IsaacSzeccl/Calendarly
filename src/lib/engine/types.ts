import type { TimeOfDay } from "@/lib/config";

/** A span of time in UTC epoch milliseconds, end exclusive. */
export type Interval = { start: number; end: number };

/** "HH:mm" in some person's own timezone. */
export type ClockRange = { start: string; end: string };

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Person = {
  name: string;
  timezone: string;
  required: boolean;
  /** Hours this person can meet, in their own timezone (hard). */
  hours?: ClockRange | null;
  notes?: string | null;
};

/**
 * One rule from the organizer's text or a guest's statement.
 * `avoid` + `hard` removes a slot ("can't do Tuesdays");
 * anything soft only adds a penalty ("doesn't like nights").
 */
export type Constraint = {
  appliesTo: string; // a person's name, "organizer", or "everyone"
  type: "avoid" | "prefer";
  strength: "hard" | "soft";
  days?: Weekday[] | null;
  timeOfDay?: TimeOfDay | null;
  between?: ClockRange | null;
  /** 1 = mild, 2 = strong. Only matters for soft rules. */
  weight?: 1 | 2 | null;
  description: string;
};

/** Everything the engine needs to know about a poll's rules. */
export type PollRules = {
  organizerName: string;
  organizerTimezone: string;
  people: Person[];
  /** Inclusive dates in the organizer's timezone, "yyyy-MM-dd". */
  window: { startDate: string; endDate: string };
  durationMinutes: number;
  workingHours: ClockRange;
  constraints: Constraint[];
  reasonableHours: ClockRange;
  onlyIfNecessary: boolean;
};

export type OptionSource = "organizer_free" | "guest_added" | "ai_added";

export type SlotOption = Interval & { id: string; source: OptionSource };

export type Choice = "yes" | "prefer_not" | "no";
export type Status = Choice | "unknown";

/** A guest as the ranking sees them. */
export type Respondent = {
  id: string;
  name: string;
  timezone: string;
  required: boolean;
  votes: Record<string, Choice>;
  /** Busy times from a connected calendar, or null when not connected. */
  busy: Interval[] | null;
  /** Soft preferences from their statement, already structured. */
  preferences: Constraint[];
  hasStatement: boolean;
};

export type Penalty = { reason: string; points: number; person?: string };

export type Label =
  | "Recommended"
  | "Works well"
  | "Works with trade-offs"
  | "Not recommended";
