import { after } from "next/server";
import { z } from "zod";
import { addGuestOption, getGuestByToken, getPollByToken, statusOf } from "@/lib/db/polls";
import { setVotes } from "@/lib/db/statements";
import { readGuestToken } from "@/lib/guest/cookie";
import { notifyNewOptions } from "@/lib/polls/actions";
import { suggestFromCalendar } from "@/lib/polls/calendarSuggest";
import { allow } from "@/lib/rateLimit";

const body = z.object({
  token: z.string().min(10).max(64),
  start: z.number().int(),
});

/**
 * A guest adds one of the times their calendar suggested. The suggestions are
 * worked out again here, so only a time that is still free for them and the
 * organizer can be added, and the database holds the cap.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Something was missing. Try again." }, { status: 400 });
  const { token, start } = parsed.data;

  const poll = await getPollByToken(token);
  if (!poll) return Response.json({ error: "This poll doesn't exist." }, { status: 404 });
  if (statusOf(poll) !== "open") return Response.json({ error: "This poll has closed." }, { status: 409 });
  const guestToken = await readGuestToken(poll.id);
  const guest = guestToken ? await getGuestByToken(poll.id, guestToken) : null;
  if (!guest) return Response.json({ error: "Save your name and email first." }, { status: 401 });
  // Each try reads several calendars, so retries are limited.
  if (!allow(`calendar-add:${guest.id}`, 10, 10 * 60_000)) {
    return Response.json({ error: "That's a lot of tries. Wait a few minutes, then try again." }, { status: 429 });
  }

  const suggest = await suggestFromCalendar(poll, guest);
  if (suggest.state === "full") {
    return Response.json({ error: "This poll already has as many suggested times as it can take." }, { status: 409 });
  }
  if (suggest.state !== "suggested") {
    return Response.json({ error: "Your calendar or the organizer's can't be checked right now. Try again later." }, { status: 503 });
  }
  const slot = suggest.suggestions.find((s) => s.start === start);
  if (!slot) return Response.json({ error: "That time isn't free any more. Reload to see fresh suggestions." }, { status: 409 });

  const option = await addGuestOption(poll.id, slot, "guest");
  if (!option) {
    return Response.json({ error: "That time was just added, or the poll is full. Reload to see where things are." }, { status: 409 });
  }
  // The guest's own calendar says they're free, so it starts as their "yes".
  await setVotes(guest.id, { [option.id]: "yes" });

  const origin = new URL(request.url).origin;
  after(() => notifyNewOptions(poll, [option], guest.id, origin));
  return Response.json({ added: { id: option.id, start: option.start, end: option.end } });
}
