import "server-only";
import { config } from "@/lib/config";
import { providerFor } from "@/lib/calendar";
import { CalendarUnavailableError } from "@/lib/calendar/provider";
import { getGuests, getOptions, type Guest, type Poll } from "@/lib/db/polls";
import { calendarSuggestions } from "@/lib/engine/slots";
import type { Interval, SlotOption } from "@/lib/engine/types";
import { guestBusyBetween } from "./guestCalendar";
import { windowRange } from "./preview";

export type CalendarSuggest =
  | { state: "suggested"; suggestions: Interval[]; options: SlotOption[] }
  /** The poll already has as many guest-added times as it can take. */
  | { state: "full" }
  /** The guest's or organizer's calendar can't be read right now. */
  | { state: "unavailable" }
  | { state: "not_connected" };

/**
 * Times this guest's connected calendar makes possible. Code decides: free for
 * the guest and the organizer, inside the rules, other connected guests' free
 * time first. The page shows these and the add route checks them again.
 */
export async function suggestFromCalendar(poll: Poll, guest: Guest, now: number = Date.now()): Promise<CalendarSuggest> {
  if (!guest.calendarConnectionId) return { state: "not_connected" };
  const range = windowRange(poll.rules);
  const [mine, options, guests] = await Promise.all([
    guestBusyBetween(guest.calendarConnectionId, range, guest.timezone),
    getOptions(poll.id),
    getGuests(poll.id),
  ]);
  if (mine.state !== "connected") return { state: mine.state === "none" ? "not_connected" : "unavailable" };

  const room = config.guestSlotCap - options.filter((o) => o.source !== "organizer_free").length;
  if (room <= 0) return { state: "full" };

  let organizerBusy: Interval[];
  try {
    organizerBusy = await providerFor(poll.organizerCalendar).getBusy(poll.organizerCalendar, range.start, range.end);
  } catch (e) {
    // Suggestions are extra: any failure here hides them instead of breaking the guest's page.
    if (!(e instanceof CalendarUnavailableError)) console.error("organizer free/busy for suggestions failed:", e);
    return { state: "unavailable" };
  }
  const others = await Promise.all(
    guests
      .filter((g) => g.id !== guest.id && g.calendarConnectionId)
      .map((g) => guestBusyBetween(g.calendarConnectionId, range, g.timezone)),
  );

  const suggestions = calendarSuggestions({
    rules: poll.rules,
    organizerBusy,
    guest: { name: guest.name, timezone: guest.timezone, busy: mine.busy },
    othersBusy: others.flatMap((o) => (o.state === "connected" ? [o.busy] : [])),
    existing: options,
    room,
    now,
  });
  return { state: "suggested", suggestions, options };
}
