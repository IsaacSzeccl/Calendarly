import { z } from "zod";
import { getGuestByToken, getPollByToken, setRemember } from "@/lib/db/polls";
import { readGuestToken } from "@/lib/guest/cookie";

const body = z.object({ token: z.string().min(10).max(64), remember: z.boolean() });

/** "Remember me for future meetings with this organizer": only with a connected calendar, off by default. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Something was missing. Try again." }, { status: 400 });
  const poll = await getPollByToken(parsed.data.token);
  const guestToken = poll ? await readGuestToken(poll.id) : null;
  const guest = poll && guestToken ? await getGuestByToken(poll.id, guestToken) : null;
  if (!guest) return Response.json({ error: "Save your name and email first." }, { status: 401 });
  if (parsed.data.remember && !guest.calendarConnectionId) {
    return Response.json({ error: "Connect your calendar first, so it can answer for you next time." }, { status: 409 });
  }
  await setRemember(guest, parsed.data.remember);
  return Response.json({ remember: parsed.data.remember });
}
