import "server-only";
import { providerFor } from "@/lib/calendar";
import { db, maybe } from "@/lib/db/client";
import { getGuests, getOptions, getPoll, getVotes, statusOf, updatePoll, type Poll } from "@/lib/db/polls";
import { isComplete } from "@/lib/engine/rank";
import { sendEmail } from "@/lib/email/send";
import { confirmationEmail, newOptionsEmail, pollUpdateEmail } from "@/lib/email/templates";

/** Links in emails point at the deployed site when APP_URL is set. */
export function publicOrigin(fallback: string): string {
  return (process.env.APP_URL || fallback).replace(/\/$/, "");
}

/**
 * Send the organizer's "X of Y" email at most once per poll. The conditional
 * update claims the send, so two guests answering at once can't both trigger it.
 */
async function sendPollUpdateOnce(poll: Poll, reason: "complete" | "closed", origin: string): Promise<void> {
  if (!poll.organizerEmail) return;
  const claimed = maybe(
    await db()
      .from("polls")
      .update({ update_sent_at: new Date().toISOString() })
      .eq("id", poll.id)
      .is("update_sent_at", null)
      .select("id")
      .maybeSingle(),
    "claim poll update",
  );
  if (!claimed) return;
  const guests = await getGuests(poll.id);
  const count = isComplete(guests.length, poll.expectedCount).text;
  const email = pollUpdateEmail({
    title: poll.title,
    countText: count,
    reason,
    dashboardUrl: `${publicOrigin(origin)}/poll/${poll.id}`,
  });
  await sendEmail({ kind: "poll_update", to: poll.organizerEmail, pollId: poll.id, ...email });
}

/** After each guest answer: when everyone expected has answered, tell the organizer. */
export async function afterGuestResponse(pollId: string, origin: string): Promise<void> {
  const poll = await getPoll(pollId);
  if (!poll || poll.updateSentAt) return;
  const guests = await getGuests(poll.id);
  if (isComplete(guests.length, poll.expectedCount).complete) {
    await sendPollUpdateOnce(poll, "complete", origin);
  }
}

export async function closePoll(poll: Poll, origin: string): Promise<void> {
  if (statusOf(poll) === "finalized") return;
  await updatePoll(poll.id, { status: "closed" });
  await sendPollUpdateOnce(poll, "closed", origin);
}

/**
 * The organizer picks: create the event on their calendar, record the pick,
 * and email every guest the time with an add-to-calendar link.
 */
export async function finalizePoll(
  poll: Poll,
  optionId: string,
): Promise<{ ok: true; calendarEvent: boolean } | { ok: false; error: string }> {
  if (statusOf(poll) === "finalized") return { ok: false, error: "A time has already been picked." };
  const option = (await getOptions(poll.id)).find((o) => o.id === optionId);
  if (!option) return { ok: false, error: "That time isn't part of this poll." };

  let eventId: string | null = null;
  try {
    const created = await providerFor(poll.organizerCalendar).createEvent(poll.organizerCalendar, {
      title: poll.title,
      start: option.start,
      end: option.end,
      timezone: poll.rules.organizerTimezone,
      description: "Scheduled with Calendarly.",
    });
    eventId = created.id;
  } catch (e) {
    console.error("createEvent failed:", e instanceof Error ? e.message : e);
  }

  await updatePoll(poll.id, { status: "finalized", final_option_id: option.id, google_event_id: eventId });

  const guests = await getGuests(poll.id);
  await Promise.all(
    guests.map((g) =>
      sendEmail({
        kind: "confirmation",
        to: g.email,
        pollId: poll.id,
        ...confirmationEmail({
          guestName: g.name,
          guestZone: g.timezone,
          title: poll.title,
          organizerName: poll.organizerName,
          start: option.start,
          end: option.end,
        }),
      }),
    ),
  );
  return { ok: true, calendarEvent: eventId !== null };
}

/** Tell everyone who already voted (except whoever suggested them) that new times exist. */
export async function notifyNewOptions(
  poll: Poll,
  added: { start: number; end: number }[],
  suggestedBy: string,
  origin: string,
): Promise<void> {
  const [guests, options] = await Promise.all([getGuests(poll.id), getOptions(poll.id)]);
  const voted = new Set(
    (await getVotes(options.map((o) => o.id))).map((v) => v.guestId),
  );
  const pollUrl = `${publicOrigin(origin)}/p/${poll.shareToken}`;
  await Promise.all(
    guests
      .filter((g) => g.id !== suggestedBy && voted.has(g.id))
      .map((g) =>
        sendEmail({
          kind: "new_options",
          to: g.email,
          pollId: poll.id,
          ...newOptionsEmail({ guestName: g.name, title: poll.title, slots: added, guestZone: g.timezone, pollUrl }),
        }),
      ),
  );
}
