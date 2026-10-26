import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/calendar/google";
import { takeIntent } from "@/lib/calendar/oauthState";
import { db, ok } from "@/lib/db/client";
import { saveConnection } from "@/lib/db/connections";

/** Google sends the person back here after they approve calendar access. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const intent = await takeIntent(params.get("state"));
  if (!intent) return NextResponse.redirect(new URL("/?calendar=expired", request.url));
  const back = (why: string) => NextResponse.redirect(new URL(`${intent.returnTo}?calendar=${why}`, request.url));

  const code = params.get("code");
  if (!code) return back(params.get("error") === "access_denied" ? "declined" : "failed");

  try {
    const { refreshToken, scope } = await exchangeCode(code, `${request.nextUrl.origin}/api/calendar/callback`);
    const id = await saveConnection({ ownerKind: intent.owner, ownerId: intent.ownerId, refreshToken, scope });
    if (intent.owner === "guest") {
      ok(await db().from("guests").update({ calendar_connection_id: id }).eq("id", intent.ownerId), "link guest calendar");
    }
    return back("connected");
  } catch (e) {
    console.error("calendar callback failed:", e instanceof Error ? e.message : e);
    return back("failed");
  }
}
