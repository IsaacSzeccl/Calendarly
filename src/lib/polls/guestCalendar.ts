import "server-only";
import { providerFor } from "@/lib/calendar";
import { CalendarUnavailableError } from "@/lib/calendar/provider";
import { connectionStatus } from "@/lib/db/connections";
import type { Interval, SlotOption } from "@/lib/engine/types";

export type GuestCalendar =
  | { state: "connected"; busy: Interval[] }
  | { state: "needs_reconnect" }
  | { state: "none" };

/**
 * A guest's busy times over the poll's options, read only when they connected.
 * A failure never breaks the page: that person is just flagged for reconnecting.
 */
export async function guestBusy(connectionId: string | null, options: SlotOption[]): Promise<GuestCalendar> {
  if (!connectionId || options.length === 0) return { state: "none" };
  if ((await connectionStatus(connectionId)) !== "active") return { state: "needs_reconnect" };
  const from = Math.min(...options.map((o) => o.start));
  const to = Math.max(...options.map((o) => o.end));
  try {
    const account = { kind: "google" as const, connectionId };
    return { state: "connected", busy: await providerFor(account).getBusy(account, from, to) };
  } catch (e) {
    if (!(e instanceof CalendarUnavailableError)) console.error("guest free/busy failed:", e);
    return { state: "needs_reconnect" };
  }
}
