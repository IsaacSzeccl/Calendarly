import { z } from "zod";
import { getOrganizer } from "@/lib/auth/organizer";
import { CalendarUnavailableError, inZone } from "@/lib/calendar/provider";
import { createPoll } from "@/lib/db/polls";
import { previewOptions } from "@/lib/polls/preview";
import { draftSchema } from "@/lib/polls/schema";

const body = z.object({
  draft: draftSchema,
  closeAt: z.iso.datetime({ offset: true }).nullish(),
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
  const { draft, closeAt } = parsed.data;
  const rules = { ...draft.rules, organizerName: organizer.name };
  const calendar = inZone(organizer.calendar, rules.organizerTimezone);

  let options;
  try {
    ({ options } = await previewOptions(rules, calendar));
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
    expectedCount: draft.expectedCount,
    calendar,
    closeAt: closeAt ? Date.parse(closeAt) : null,
    options,
  });
  const origin = new URL(request.url).origin;
  return Response.json({
    id: poll.id,
    shareUrl: `${origin}/p/${poll.shareToken}`,
    dashboardUrl: `/poll/${poll.id}`,
  });
}
