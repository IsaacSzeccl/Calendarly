import { after } from "next/server";
import { z } from "zod";
import { providerFor } from "@/lib/calendar";
import { CalendarUnavailableError } from "@/lib/calendar/provider";
import { addGuestOption, getGuestByToken, getOptions, getPollByToken, statusOf } from "@/lib/db/polls";
import { setVotes } from "@/lib/db/statements";
import { addAiSlots } from "@/lib/engine/slots";
import { readGuestToken } from "@/lib/guest/cookie";
import { notifyNewOptions } from "@/lib/polls/actions";
import { windowRange } from "@/lib/polls/preview";
import { allow } from "@/lib/rateLimit";

const body = z.object({ token: z.string().min(10).max(64), start: z.number().int() });

const WHY: Record<string, string> = {
  busy: "That time doesn't work for the organizer. Try another.",
  duplicate: "That overlaps a time already in the poll.",
  cap: "This poll can't take more times.",
};

/**
 * A guest picks a time by hand. Code checks it like any suggestion: inside the
 * poll's dates and hours, the organizer free, no overlap, within the cap of 3.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a day and a time." }, { status: 400 });
  const poll = await getPollByToken(parsed.data.token);
  if (!poll) return Response.json({ error: "This poll doesn't exist." }, { status: 404 });
  if (statusOf(poll) !== "open") return Response.json({ error: "This poll has closed." }, { status: 409 });
  const guestToken = await readGuestToken(poll.id);
  const guest = guestToken ? await getGuestByToken(poll.id, guestToken) : null;
  if (!guest) return Response.json({ error: "Add your name and email first." }, { status: 401 });
  if (!allow(`add-time:${guest.id}`, 10, 10 * 60_000)) {
    return Response.json({ error: "That's a lot of tries. Wait a few minutes." }, { status: 429 });
  }

  const window = windowRange(poll.rules);
  const slot = { start: parsed.data.start, end: parsed.data.start + poll.rules.durationMinutes * 60_000 };
  let organizerBusy, existing;
  try {
    [organizerBusy, existing] = await Promise.all([
      providerFor(poll.organizerCalendar).getBusy(poll.organizerCalendar, window.start, window.end),
      getOptions(poll.id),
    ]);
  } catch (e) {
    if (!(e instanceof CalendarUnavailableError)) throw e;
    return Response.json({ error: "The organizer's calendar can't be checked right now. Try later." }, { status: 503 });
  }

  const result = addAiSlots({
    ranges: [slot],
    rules: poll.rules,
    organizerBusy,
    existing,
    aiAddedSoFar: existing.filter((o) => o.source !== "organizer_free").length,
    now: Date.now(),
  });
  if (result.added.length === 0) {
    return Response.json({ error: WHY[result.skipped[0]?.why ?? "busy"] }, { status: 409 });
  }
  const option = await addGuestOption(poll.id, result.added[0], "guest");
  if (!option) return Response.json({ error: "That time was just taken, or the poll is full." }, { status: 409 });
  // They picked it, so it starts as their "yes".
  await setVotes(guest.id, { [option.id]: "yes" });

  const origin = new URL(request.url).origin;
  after(() => notifyNewOptions(poll, [option], guest.id, origin));
  return Response.json({ added: { id: option.id, start: option.start, end: option.end } });
}
