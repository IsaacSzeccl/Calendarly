import { DateTime } from "luxon";
import type { Interval, Weekday } from "@/lib/engine/types";
import type { CalendarAccount, CalendarProvider, NewEvent } from "./provider";

/** A repeating busy block: every listed weekday, between two local times. */
type WeeklyBlock = { days: Weekday[]; start: string; end: string };

type SampleCalendar = { label: string; timezone: string; blocks: WeeklyBlock[] };

/**
 * Hand-designed calendars for demo people who are not real Google accounts.
 * The app labels these "sample calendar" wherever they appear.
 */
export const SAMPLE_CALENDARS: Record<string, SampleCalendar> = {
  organizer: {
    label: "Sample calendar (organizer)",
    timezone: "Asia/Hong_Kong",
    blocks: [
      { days: [1, 3, 5], start: "09:00", end: "11:00" },
      { days: [2], start: "13:00", end: "15:00" },
      { days: [4], start: "10:00", end: "12:30" },
      { days: [1, 2, 3, 4, 5], start: "12:30", end: "13:30" },
    ],
  },
  // Test mode only: what a guest "connects" when they choose the sample calendar.
  guest: {
    label: "Sample calendar (guest)",
    timezone: "Asia/Hong_Kong",
    blocks: [
      { days: [1, 3], start: "13:00", end: "18:00" },
      { days: [2], start: "09:00", end: "15:00" },
      { days: [5], start: "08:00", end: "20:00" },
    ],
  },
};

export function expandWeekly(cal: SampleCalendar, from: number, to: number): Interval[] {
  const out: Interval[] = [];
  let day = DateTime.fromMillis(from, { zone: cal.timezone }).startOf("day");
  const end = DateTime.fromMillis(to, { zone: cal.timezone });
  while (day < end) {
    for (const b of cal.blocks) {
      if (!b.days.includes(day.weekday as Weekday)) continue;
      const [sh, sm] = b.start.split(":").map(Number);
      const [eh, em] = b.end.split(":").map(Number);
      const s = day.set({ hour: sh, minute: sm }).toMillis();
      const e = day.set({ hour: eh, minute: em }).toMillis();
      if (e > from && s < to) out.push({ start: Math.max(s, from), end: Math.min(e, to) });
    }
    day = day.plus({ days: 1 });
  }
  return out;
}

export class SeededCalendarProvider implements CalendarProvider {
  /** Events "created" on sample calendars, so a demo pick is visible afterwards. */
  readonly created: (NewEvent & { id: string; key: string })[] = [];

  async getBusy(account: CalendarAccount, from: number, to: number): Promise<Interval[]> {
    if (account.kind !== "sample") throw new Error("Seeded provider only reads sample calendars");
    const cal = SAMPLE_CALENDARS[account.key];
    if (!cal) return [];
    // A sample calendar follows its owner's timezone when one is given.
    return expandWeekly({ ...cal, timezone: account.timezone ?? cal.timezone }, from, to);
  }

  async createEvent(account: CalendarAccount, event: NewEvent): Promise<{ id: string }> {
    if (account.kind !== "sample") throw new Error("Seeded provider only writes sample calendars");
    const id = `sample-${account.key}-${event.start}`;
    this.created.push({ ...event, id, key: account.key });
    return { id };
  }
}
