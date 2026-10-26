import { NextResponse, type NextRequest } from "next/server";
import { getOrganizer, testModeOn } from "@/lib/auth/organizer";
import { SCOPES, authUrl } from "@/lib/calendar/google";
import { startIntent } from "@/lib/calendar/oauthState";
import { db, ok } from "@/lib/db/client";
import { SAMPLE_SCOPE, deleteConnection, findConnection, saveConnection } from "@/lib/db/connections";
import { forgetConnection } from "@/lib/db/polls";
import { revokeToken } from "@/lib/calendar/google";
import { getGuestByToken, getPollByToken } from "@/lib/db/polls";
import { readGuestToken } from "@/lib/guest/cookie";

/**
 * Start "Connect Google Calendar". Organizers grant free/busy plus event
 * creation; guests grant free/busy only, with no account.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const redirectUri = `${request.nextUrl.origin}/api/calendar/callback`;
  const back = (path: string, why: string) => NextResponse.redirect(new URL(`${path}?calendar=${why}`, request.url));

  if (params.get("for") === "guest") {
    const token = params.get("token") ?? "";
    const poll = await getPollByToken(token);
    if (!poll) return back("/", "missing-poll");
    const guestToken = await readGuestToken(poll.id);
    const guest = guestToken ? await getGuestByToken(poll.id, guestToken) : null;
    if (!guest) return back(`/p/${token}`, "save-first");
    if (params.get("sample") === "1" && testModeOn()) {
      // Test mode: a labeled sample calendar stands in for Google, so the flow can be tried and tested.
      // A real connection is removed and revoked first, never silently turned into a sample.
      const existing = await findConnection("guest", guest.id);
      if (existing) {
        await forgetConnection(existing.id);
        const old = await deleteConnection(existing.id);
        if (old) await revokeToken(old);
      }
      const id = await saveConnection({ ownerKind: "guest", ownerId: guest.id, refreshToken: SAMPLE_SCOPE, scope: SAMPLE_SCOPE });
      ok(await db().from("guests").update({ calendar_connection_id: id }).eq("id", guest.id), "link sample calendar");
      return back(`/p/${token}`, "connected");
    }
    const state = await startIntent({ owner: "guest", ownerId: guest.id, returnTo: `/p/${token}`, pollId: poll.id });
    return NextResponse.redirect(
      authUrl({ clientId: process.env.GOOGLE_CLIENT_ID!, redirectUri, scopes: SCOPES.guest, state }),
    );
  }

  const organizer = await getOrganizer();
  if (!organizer || organizer.isTest) return back("/new", "sign-in-first");
  const state = await startIntent({ owner: "organizer", ownerId: organizer.id, returnTo: "/new" });
  return NextResponse.redirect(
    authUrl({ clientId: process.env.GOOGLE_CLIENT_ID!, redirectUri, scopes: SCOPES.organizer, state }),
  );
}
