import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

/** Google sends the organizer back here; swap the code for a session. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const raw = request.nextUrl.searchParams.get("next") ?? "/new";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/new";
  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/?signin=failed", request.url));
}
