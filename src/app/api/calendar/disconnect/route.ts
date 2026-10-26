import { z } from "zod";
import { getOrganizer } from "@/lib/auth/organizer";
import { revokeToken } from "@/lib/calendar/google";
import { db, ok } from "@/lib/db/client";
import { deleteConnection, findConnection } from "@/lib/db/connections";
import { forgetConnection, getGuestByToken, getPollByToken } from "@/lib/db/polls";
import { readGuestToken } from "@/lib/guest/cookie";

const body = z.object({ for: z.enum(["organizer", "guest"]), token: z.string().optional() });

/** Disconnecting deletes the stored token and revokes it with Google straight away. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nothing to disconnect." }, { status: 400 });

  let connectionId: string | null = null;
  if (parsed.data.for === "guest") {
    const poll = await getPollByToken(parsed.data.token ?? "");
    const guestToken = poll ? await readGuestToken(poll.id) : null;
    const guest = poll && guestToken ? await getGuestByToken(poll.id, guestToken) : null;
    if (!guest) return Response.json({ error: "Nothing to disconnect." }, { status: 404 });
    connectionId = guest.calendarConnectionId;
    ok(
      await db().from("guests").update({ calendar_connection_id: null, remember: false }).eq("id", guest.id),
      "unlink guest calendar",
    );
  } else {
    const organizer = await getOrganizer();
    // Look the connection up whatever its state, so an expired one is still removed and revoked.
    if (organizer && !organizer.isTest) connectionId = (await findConnection("organizer", organizer.id))?.id ?? null;
  }
  if (!connectionId) return Response.json({ ok: true });

  // Without a calendar, "remember me" has nothing to answer with, so the consent goes too.
  await forgetConnection(connectionId);
  const token = await deleteConnection(connectionId);
  if (token) await revokeToken(token);
  return Response.json({ ok: true });
}
