import { NextResponse, type NextRequest } from "next/server";
import { getOrganizer } from "@/lib/auth/organizer";
import { SCOPES, authUrl } from "@/lib/calendar/google";
import { startIntent } from "@/lib/calendar/oauthState";
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
