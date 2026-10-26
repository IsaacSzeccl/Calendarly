import "server-only";
import { providerFor } from "@/lib/calendar";
import { CalendarUnavailableError } from "@/lib/calendar/provider";
import type { Poll } from "@/lib/db/polls";
import { buildCandidatePool } from "@/lib/engine/slots";
import { overlaps } from "@/lib/engine/time";
import type { SlotOption } from "@/lib/engine/types";
import { windowRange } from "./preview";

/**
 * The start times a guest can pick by hand: the organizer is free, the poll's
 * rules allow it, and it doesn't clash with a time already in the poll. The
 * add route checks again when one is picked. Null when the organizer's
 * calendar can't be read right now.
 */
export async function pickableStarts(poll: Poll, options: SlotOption[], now: number): Promise<number[] | null> {
  const range = windowRange(poll.rules);
  try {
    const busy = await providerFor(poll.organizerCalendar).getBusy(poll.organizerCalendar, range.start, range.end);
    return buildCandidatePool(poll.rules, busy, now)
      .filter((slot) => !options.some((o) => overlaps(o, slot)))
      .map((slot) => slot.start);
  } catch (e) {
    if (!(e instanceof CalendarUnavailableError)) console.error("pickable times failed:", e);
    return null;
  }
}
