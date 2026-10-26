import { z } from "zod";
import { getOrganizer } from "@/lib/auth/organizer";
import { CalendarUnavailableError, inZone } from "@/lib/calendar/provider";
import { createPoll } from "@/lib/db/polls";
import { after } from "next/server";
import { bringAlong, emailBroughtAlong, rosterBusy, rosterFrom } from "@/lib/polls/meetAgain";
import { previewOptions, windowRange } from "@/lib/polls/preview";
import { withPeople } from "@/lib/polls/roster";
import { draftSchema } from "@/lib/polls/schema";

const body = z.object({
  draft: draftSchema,
  closeAt: z.iso.datetime({ offset: true }).nullish(),
  /** Meet again: the poll whose remembered guests come along. */
  again: z.uuid().optional(),
});

/** Create the poll. Options are recomputed here; the browser's copy is never trusted. */
export async function POST(request: Request) {
  const organizer = await getOrganizer();
  if (!organizer) return Response.json({ error: "Sign in to create a poll." }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Some poll details are missing or invalid." }, { status: 400 });
  }
  if (!organizer.calendar) {
    return Response.json({ error: "Connect your Google Calendar first, so times come from your free time." }, { status: 409 });
  }
  const { draft, closeAt, again } = parsed.data;
  const roster = again ? await rosterFrom(again, organizer.id) : null;
  const rules = withPeople({ ...draft.rules, organizerName: organizer.name }, roster?.people ?? []);
  const calendar = inZone(organizer.calendar, rules.organizerTimezone);

  let options;
  try {
    const othersBusy = roster ? await rosterBusy(roster.people, windowRange(rules)) : [];
    ({ options } = await previewOptions(rules, calendar, undefined, othersBusy));
  } catch (e) {
    if (e instanceof CalendarUnavailableError) {
      return Response.json({ error: "Your Google Calendar needs reconnecting. Connect it again, then retry." }, { status: 409 });
    }
    throw e;
  }
  if (options.length === 0) {
    return Response.json(
      { error: "No times fit yet. Widen the dates or hours, then try again." },
      { status: 422 },
    );
  }

  const poll = await createPoll({
    organizer,
    title: draft.title,
    rules,
    expectedCount: Math.max(draft.expectedCount, rules.people.length + 1),
    calendar,
    closeAt: closeAt ? Date.parse(closeAt) : null,
    options,
  });
  const origin = new URL(request.url).origin;
  if (roster?.people.length) {
    // Their calendars answer straight away; each gets a private link to see or change it.
    // The poll exists either way, so a failure here never makes the organizer create it twice.
    try {
      const copies = await bringAlong(poll, roster.people);
      after(() => emailBroughtAlong(poll, copies, origin));
    } catch (e) {
      console.error("meet again: copying guests failed:", e);
    }
  }
  return Response.json({
    id: poll.id,
    shareUrl: `${origin}/p/${poll.shareToken}`,
    dashboardUrl: `/poll/${poll.id}`,
  });
}
