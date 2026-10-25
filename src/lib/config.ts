// Tunable numbers in one place. The unit tests pin these values, so changing
// one is a deliberate decision, not an accident.

export const config = {
  /** Candidate start times move in steps of this many minutes. */
  slotStepMinutes: 15,
  /** How many options a new poll starts with. */
  initialOptionCount: 5,
  /** Most times guests can add to one poll, from typed statements and calendars together. */
  guestSlotCap: 3,
  /** Default meeting length when the organizer doesn't say. */
  defaultDurationMinutes: 60,
  /** Nobody is offered a time outside these hours, in their own timezone. */
  reasonableHours: { start: "08:00", end: "21:00" },
  /** Organizer's working hours when they don't say. */
  defaultWorkingHours: { start: "09:00", end: "17:00" },
  /** Default poll window when the text gives none: the next N days. */
  defaultWindowDays: 7,

  /** Named penalties. Scores are internal and never shown. */
  weights: {
    no: 10,
    requiredNo: 1000,
    preferNot: 3,
    /**
     * Someone answered the poll but left this time blank (often a time added after they
     * answered). Unknown, so about half a "no"; more when that person must attend.
     */
    unmarked: 5,
    requiredUnmarked: 15,
    softConstraint: 2,
    /** Applied per option already chosen on the same day, when picking initial options. */
    sameDay: 1.5,
  },

  /** Score bands for the fuzzy labels (score at or below the band). */
  labelBands: {
    recommended: 2,
    worksWell: 6,
    tradeOffs: 25,
  },

  /** Time-of-day words, in the person's own timezone. */
  timeOfDay: {
    morning: { start: "06:00", end: "12:00" },
    afternoon: { start: "12:00", end: "17:00" },
    evening: { start: "17:00", end: "21:00" },
    night: { start: "21:00", end: "06:00" },
  },

  ai: {
    /** Give up on one model call after this long. */
    timeoutMs: 45_000,
  },
} as const;

export type TimeOfDay = keyof typeof config.timeOfDay;
