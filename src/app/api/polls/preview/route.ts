import { z } from "zod";
import { parsePoll, type PollDraft } from "@/lib/ai/parsePoll";
import { getOrganizer } from "@/lib/auth/organizer";
import { CalendarUnavailableError, inZone } from "@/lib/calendar/provider";
import { isValidZone } from "@/lib/engine/time";
import { allow } from "@/lib/rateLimit";
import { previewOptions } from "@/lib/polls/preview";
import { draftSchema } from "@/lib/polls/schema";

const body = z.union([
  // First pass: plain language, read by the model.
  z.object({ text: z.string().trim().min(3).max(2000), timezone: z.string().refine(isValidZone) }),
  // Later passes: the organizer edited the summary; no model call.
  z.object({ draft: draftSchema }),
]);

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Please describe the meeting first." }, { status: 400 });
  }

  const organizer = await getOrganizer();
  let draft: PollDraft;
  if ("text" in parsed.data) {
    // Reading a description costs a model call: visitors who aren't signed in get a few per hour.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!organizer && !allow(`preview:${ip}`, 10, 60 * 60_000)) {
      return Response.json(
        { error: "You've tried a lot of descriptions. Sign in to keep going, or wait a while." },
        { status: 429 },
      );
    }
    const result = await parsePoll({ text: parsed.data.text, timezone: parsed.data.timezone });
    if (!result.ok) {
      return Response.json(
        {
          error:
            "I couldn't read that. Try something like: “A one-hour meeting next week with Sam and Priya, afternoons are best, Sam has to be there.”",
        },
        { status: 422 },
      );
    }
    draft = result.data;
  } else {
    draft = parsed.data.draft;
  }

  // Signed-in organizers see their real free time; visitors trying it out see a sample calendar.
  const account = inZone(organizer?.calendar ?? { kind: "sample", key: "organizer" }, draft.rules.organizerTimezone);
  try {
    const { options, poolSize } = await previewOptions(draft.rules, account);
    return Response.json({ draft, options, poolSize, calendar: account.kind });
  } catch (e) {
    if (e instanceof CalendarUnavailableError) {
      return Response.json(
        { error: "Your Google Calendar needs reconnecting. Connect it again, then retry." },
        { status: 409 },
      );
    }
    throw e;
  }
}
