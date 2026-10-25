import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

const safe = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/new");

/** Start "Sign in with Google" through Supabase. */
export async function GET(request: NextRequest) {
  const next = safe(request.nextUrl.searchParams.get("next"));
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
