import "server-only";
import { providerFor } from "@/lib/calendar";
import { CalendarUnavailableError } from "@/lib/calendar/provider";
import { connectionAccount } from "@/lib/db/connections";
import type { Interval, SlotOption } from "@/lib/engine/types";

export type GuestCalendar =
  | { state: "connected"; busy: Interval[]; sample: boolean }
  | { state: "needs_reconnect" }
  | { state: "none" };

/**
 * A guest's busy times over the poll's options, read only when they connected.
 * A failure never breaks the page: that person is just flagged for reconnecting.
 */
export async function guestBusy(
  connectionId: string | null,
  options: SlotOption[],
  timezone?: string,
): Promise<GuestCalendar> {
  if (options.length === 0) return { state: "none" };
  const range = { start: Math.min(...options.map((o) => o.start)), end: Math.max(...options.map((o) => o.end)) };
  return guestBusyBetween(connectionId, range, timezone);
}

/** The same, over any range (the whole poll window when suggesting new times). */
export async function guestBusyBetween(
  connectionId: string | null,
  range: Interval,
  timezone?: string,
): Promise<GuestCalendar> {
  if (!connectionId) return { state: "none" };
  const connection = await connectionAccount(connectionId, timezone);
  if (!connection) return { state: "none" };
  if (connection.status !== "active") return { state: "needs_reconnect" };
  const { account, sample } = connection;
  try {
    return { state: "connected", busy: await providerFor(account).getBusy(account, range.start, range.end), sample };
  } catch (e) {
    if (!(e instanceof CalendarUnavailableError)) console.error("guest free/busy failed:", e);
    return { state: "needs_reconnect" };
  }
}
