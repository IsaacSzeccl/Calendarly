import { NextResponse, type NextRequest } from "next/server";
import { getGuestByToken, getPollByToken, takeClaim } from "@/lib/db/polls";
import { readGuestToken, writeGuestToken } from "@/lib/guest/cookie";

/**
 * A guest's private link, from a "meet again" or "your private link" email.
 * The code works once: it sets that guest's cookie for the poll, then sends
 * them on to it. A browser that is already someone on this poll keeps who it
 * is, so a link sent by someone else can't switch identities behind the
 * guest's back. Anything unknown just opens the poll.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const poll = await getPollByToken(params.get("poll") ?? "");
  if (!poll) return NextResponse.redirect(new URL("/", request.url));
  const toPoll = NextResponse.redirect(new URL(`/p/${poll.shareToken}`, request.url));

  const current = await readGuestToken(poll.id);
  if (current && (await getGuestByToken(poll.id, current))) return toPoll;

  const code = params.get("code") ?? "";
  const guestToken = code ? await takeClaim(poll.id, code) : null;
  if (guestToken) await writeGuestToken(poll.id, guestToken);
  return toPoll;
}
