import { z } from "zod";
import { getOrganizer } from "@/lib/auth/organizer";
import { revokeToken } from "@/lib/calendar/google";
import { db, ok } from "@/lib/db/client";
import { deleteConnection } from "@/lib/db/connections";
import { getGuestByToken, getPollByToken } from "@/lib/db/polls";
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
    ok(await db().from("guests").update({ calendar_connection_id: null }).eq("id", guest.id), "unlink guest calendar");
  } else {
    const organizer = await getOrganizer();
    if (organizer?.calendar?.kind === "google") connectionId = organizer.calendar.connectionId;
  }
  if (!connectionId) return Response.json({ ok: true });

  const token = await deleteConnection(connectionId);
  if (token) await revokeToken(token);
  return Response.json({ ok: true });
}
