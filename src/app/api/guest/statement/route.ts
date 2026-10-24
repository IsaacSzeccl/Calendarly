import { z } from "zod";
import { parseStatement } from "@/lib/ai/parseStatement";
import { getGuestByToken, getPollByToken, statusOf } from "@/lib/db/polls";
import { createStatement } from "@/lib/db/statements";
import { isValidZone } from "@/lib/engine/time";
import { readGuestToken } from "@/lib/guest/cookie";

const body = z.object({
  token: z.string().min(10).max(64),
  text: z.string().trim().min(3).max(1000),
  timezone: z.string().refine(isValidZone),
});

const REPHRASE =
  "I couldn't read that. Try something like “Tuesday or Wednesday afternoons, not Mondays”.";

/** Step 1: read the guest's words. Nothing is added until they confirm. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Write when you're free first." }, { status: 400 });
  const { token, text, timezone } = parsed.data;

  const poll = await getPollByToken(token);
  if (!poll) return Response.json({ error: "This poll doesn't exist." }, { status: 404 });
  if (statusOf(poll) !== "open") return Response.json({ error: "This poll has closed." }, { status: 409 });
  const guestToken = await readGuestToken(poll.id);
  const guest = guestToken ? await getGuestByToken(poll.id, guestToken) : null;
  if (!guest) return Response.json({ error: "Save your name and email first." }, { status: 401 });

  const result = await parseStatement({ text, timezone, guestName: guest.name, window: poll.rules.window });
  if (!result.ok) return Response.json({ error: REPHRASE }, { status: 422 });
  if (result.data.ranges.length === 0) {
    return Response.json({ error: REPHRASE }, { status: 422 });
  }

  const statementId = await createStatement({ pollId: poll.id, guestId: guest.id, text, interpretation: result.data });
  return Response.json({ statementId, interpretation: result.data });
}
