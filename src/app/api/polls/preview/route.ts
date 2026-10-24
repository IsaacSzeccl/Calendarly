import { z } from "zod";
import { parsePoll, type PollDraft } from "@/lib/ai/parsePoll";
import { isValidZone } from "@/lib/engine/time";
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

  let draft: PollDraft;
  if ("text" in parsed.data) {
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

  const organizer = { kind: "sample" as const, key: "organizer", timezone: draft.rules.organizerTimezone };
  const { options, poolSize } = await previewOptions(draft.rules, organizer);
  return Response.json({ draft, options, poolSize, calendar: "sample" });
}
