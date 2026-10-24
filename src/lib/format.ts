import { DateTime } from "luxon";

export function dayLabel(ms: number, zone: string): string {
  return DateTime.fromMillis(ms, { zone }).toFormat("ccc d LLL");
}

export function timeRange(start: number, end: number, zone: string): string {
  const s = DateTime.fromMillis(start, { zone });
  const e = DateTime.fromMillis(end, { zone });
  return `${s.toFormat("HH:mm")}–${e.toFormat("HH:mm")}`;
}

export function dateTimeLabel(ms: number, zone: string): string {
  return DateTime.fromMillis(ms, { zone }).toFormat("ccc d LLL, HH:mm");
}

export function slotLabel(start: number, end: number, zone: string): string {
  return `${dayLabel(start, zone)}, ${timeRange(start, end, zone)}`;
}

/** Short zone name for display, e.g. "GMT", "HKT", or the city. */
export function zoneShort(zone: string, at: number = Date.now()): string {
  const dt = DateTime.fromMillis(at, { zone });
  return dt.offsetNameShort?.startsWith("GMT+") || dt.offsetNameShort?.startsWith("UTC")
    ? zone.split("/").pop()!.replace(/_/g, " ")
    : (dt.offsetNameShort ?? zone);
}

export function groupByDay<T extends { start: number }>(items: T[], zone: string) {
  const groups: { day: string; items: T[] }[] = [];
  for (const item of [...items].sort((a, b) => a.start - b.start)) {
    const day = dayLabel(item.start, zone);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}
