// Real model answers (Z.ai glm, recorded 2026-10-25, a Sunday), replayed by the mock model.
// "@D+n" means today plus n days, so the recordings never go stale.

export type Recording = { job: "parsePoll" | "parseStatement"; match: string; answer: unknown };

export const RECORDINGS: Recording[] = [
  {
    job: "parsePoll",
    match: "meet with Tom and Jamie",
    answer: {
      title: "Upcoming collaboration",
      people: [
        { name: "Tom", timezone: null, hours: null, required: false, notes: null },
        {
          name: "Jamie",
          timezone: "Europe/London",
          hours: { start: "09:00", end: "18:00" },
          required: false,
          notes: null,
        },
      ],
      expectedCount: 3,
      window: { startDate: "@D+1", endDate: "@D+5" },
      durationMinutes: null,
      workingHours: { start: "09:00", end: "17:00" },
      constraints: [
        {
          appliesTo: "everyone",
          type: "prefer",
          strength: "soft",
          days: null,
          timeOfDay: "afternoon",
          between: null,
          weight: 1,
          description: "Best to be afternoon meetings",
        },
        {
          appliesTo: "Tom",
          type: "avoid",
          strength: "soft",
          days: null,
          timeOfDay: "night",
          between: null,
          weight: 1,
          description: "Tom does not like meetings at night",
        },
      ],
      reasonableHours: null,
      onlyIfNecessary: false,
      notUnderstood: [],
    },
  },
  {
    job: "parsePoll",
    match: "five other students about our group project",
    answer: {
      title: "Group Project Meeting",
      people: [
        { name: "Sam", timezone: null, hours: null, required: true, notes: "has to be there" },
        { name: "Priya", timezone: null, hours: null, required: false, notes: null },
        {
          name: "Leo",
          timezone: null,
          hours: null,
          required: false,
          notes: "only does evenings because of work",
        },
        { name: "Mei", timezone: null, hours: null, required: false, notes: null },
        { name: "Jordan", timezone: null, hours: null, required: false, notes: null },
      ],
      expectedCount: 6,
      window: { startDate: "@D+1", endDate: "@D+5" },
      durationMinutes: 120,
      workingHours: null,
      constraints: [
        {
          appliesTo: "everyone",
          type: "prefer",
          strength: "soft",
          timeOfDay: "afternoon",
          weight: 1,
          description: "afternoons are best",
        },
        {
          appliesTo: "Leo",
          type: "prefer",
          strength: "hard",
          timeOfDay: "evening",
          weight: 1,
          description: "only does evenings because of work",
        },
        {
          appliesTo: "organizer",
          type: "avoid",
          strength: "hard",
          days: [2],
          weight: 1,
          description: "organizer can't do Tuesdays",
        },
      ],
      reasonableHours: null,
      onlyIfNecessary: false,
      notUnderstood: [],
    },
  },
  {
    job: "parsePoll",
    match: "only if absolutely necessary",
    answer: {
      title: "Catch up",
      people: [],
      expectedCount: null,
      window: { startDate: "@D+1", endDate: "@D+7" },
      durationMinutes: 90,
      workingHours: null,
      constraints: [],
      reasonableHours: null,
      onlyIfNecessary: true,
      notUnderstood: [],
    },
  },
];
