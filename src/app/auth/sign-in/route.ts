import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safeNext";
import { createAuthClient } from "@/lib/supabase/server";

/** Start "Sign in with Google" through Supabase. */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"), request.url);
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${request.nextUrl.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    return NextResponse.redirect(new URL(`/?signin=failed`, request.url));
  }
  return NextResponse.redirect(data.url);
}
