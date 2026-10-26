import { DateTime } from "luxon";
import { config, type TimeOfDay } from "@/lib/config";
import type { ClockRange, Interval, Weekday } from "./types";

const MINUTE = 60_000;

export function minutesOf(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Minutes since local midnight for `ms` in `zone`. */
export function localMinutes(ms: number, zone: string): number {
  const dt = DateTime.fromMillis(ms, { zone });
  return dt.hour * 60 + dt.minute;
}

export function localWeekday(ms: number, zone: string): Weekday {
  return DateTime.fromMillis(ms, { zone }).weekday as Weekday;
}

export function localDate(ms: number, zone: string): string {
  return DateTime.fromMillis(ms, { zone }).toISODate()!;
}

/**
 * Does the whole slot sit inside a clock range in this zone?
 * Handles ranges that cross midnight ("21:00"–"06:00").
 */
export function insideClock(slot: Interval, range: ClockRange, zone: string): boolean {
  const start = localMinutes(slot.start, zone);
  const lengthMin = Math.round((slot.end - slot.start) / MINUTE);
  const end = start + lengthMin;
  const rs = minutesOf(range.start);
  const re = minutesOf(range.end);
  if (rs < re) return start >= rs && end <= re;
  // Crosses midnight: inside if entirely in [rs, 24h+re).
  const s = start < rs ? start + 1440 : start;
  return s >= rs && s + lengthMin <= re + 1440;
}

/** Does any part of the slot touch the clock range in this zone? Exact to the minute. */
export function overlapsClock(slot: Interval, range: ClockRange, zone: string): boolean {
  const start = localMinutes(slot.start, zone);
  const end = start + Math.round((slot.end - slot.start) / MINUTE);
  const rs = minutesOf(range.start);
  const re = minutesOf(range.end);
  // The range as segments of the day (two if it crosses midnight), repeated on the
  // next day so a slot that itself crosses midnight is covered too.
  const day = rs < re ? [[rs, re]] : [[rs, 1440], [0, re]];
  const segments = [...day, ...day.map(([a, b]) => [a + 1440, b + 1440])];
  return segments.some(([a, b]) => a < end && start < b);
}

export function timeOfDayRange(word: TimeOfDay): ClockRange {
  return config.timeOfDay[word];
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Subtract busy intervals from free ones. Inputs need not be sorted. */
export function subtract(free: Interval[], busy: Interval[]): Interval[] {
  const sortedBusy = [...busy].sort((x, y) => x.start - y.start);
  const out: Interval[] = [];
  for (const f of free) {
    let cursor = f.start;
    for (const b of sortedBusy) {
      if (b.end <= cursor || b.start >= f.end) continue;
      if (b.start > cursor) out.push({ start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < f.end) out.push({ start: cursor, end: f.end });
  }
  return out;
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (start < end) out.push({ start, end });
    }
  }
  return out.sort((p, q) => p.start - q.start);
}

/**
 * The working-hours blocks for each day of the window, in the zone.
 * Dates are inclusive "yyyy-MM-dd".
 */
export function dailyBlocks(
  window: { startDate: string; endDate: string },
  hours: ClockRange,
  zone: string,
): Interval[] {
  const blocks: Interval[] = [];
  let day = DateTime.fromISO(window.startDate, { zone }).startOf("day");
  const last = DateTime.fromISO(window.endDate, { zone }).startOf("day");
  const [sh, sm] = hours.start.split(":").map(Number);
  const [eh, em] = hours.end.split(":").map(Number);
  while (day <= last) {
    const start = day.set({ hour: sh, minute: sm });
    const end = day.set({ hour: eh, minute: em });
    if (end > start) blocks.push({ start: start.toMillis(), end: end.toMillis() });
    day = day.plus({ days: 1 });
  }
  return blocks;
}

export function isValidZone(zone: string): boolean {
  return DateTime.local().setZone(zone).isValid;
}

/** The parts of the busy blocks that fall inside the slot, so "why is this a No?" has an exact answer. */
export function busyInside(busy: Interval[], slot: Interval): Interval[] {
  return busy
    .filter((b) => overlaps(b, slot))
    .map((b) => ({ start: Math.max(b.start, slot.start), end: Math.min(b.end, slot.end) }))
    .sort((a, b) => a.start - b.start);
}
