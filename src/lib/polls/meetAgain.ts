import "server-only";
import { connectionStatus } from "@/lib/db/connections";
import { copyGuestInto, getGuests, getPoll, type Guest, type Poll } from "@/lib/db/polls";
import { sendEmail } from "@/lib/email/send";
import { meetAgainEmail } from "@/lib/email/templates";
import type { Interval } from "@/lib/engine/types";
import { publicOrigin } from "./actions";
import { guestBusyBetween } from "./guestCalendar";
import { whoComesAlong } from "./roster";

export type Roster = { from: Poll; people: Guest[] };

/**
 * The people "New meeting with this group" brings along from one of this
 * organizer's polls: they said "remember me" and their calendar still works.
 */
export async function rosterFrom(pollId: string, organizerId: string): Promise<Roster | null> {
  const from = await getPoll(pollId);
  if (!from || from.organizerId !== organizerId) return null;
  const consenting = whoComesAlong(await getGuests(pollId, true));
  const statuses = await Promise.all(consenting.map((g) => connectionStatus(g.calendarConnectionId!)));
  return { from, people: consenting.filter((_, i) => statuses[i] === "active") };
}

/** Their busy times, so the first options favour times they're free too. */
export async function rosterBusy(people: Guest[], range: Interval): Promise<Interval[][]> {
  const calendars = await Promise.all(people.map((g) => guestBusyBetween(g.calendarConnectionId, range, g.timezone)));
  return calendars.flatMap((c) => (c.state === "connected" ? [c.busy] : []));
}

/** Put them in the new poll. Their calendar answers for them; nobody needs to vote again. */
export async function bringAlong(poll: Poll, people: Guest[]): Promise<Guest[]> {
  return Promise.all(people.map((g) => copyGuestInto(poll.id, g)));
}

/** A guest's private link: a single-use code, never their long-lived token. */
export function privateLink(origin: string, shareToken: string, claim: string): string {
  return `${publicOrigin(origin)}/api/guest/claim?poll=${shareToken}&code=${claim}`;
}

/** Tell each of them, with a private link to see or change what their calendar answered. */
export async function emailBroughtAlong(poll: Poll, copies: Guest[], origin: string): Promise<void> {
  await Promise.all(
    copies.map((c) =>
      sendEmail({
        kind: "meet_again",
        to: c.email,
        pollId: poll.id,
        ...meetAgainEmail({
          guestName: c.name,
          organizerName: poll.organizerName,
          title: poll.title,
          link: privateLink(origin, poll.shareToken, c.claimToken!),
        }),
      }),
    ),
  );
}
