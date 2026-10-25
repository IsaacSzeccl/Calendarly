import { NextResponse, type NextRequest } from "next/server";
import { TEST_COOKIE } from "@/lib/auth/organizer";
import { createAuthClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  res.cookies.delete(TEST_COOKIE);
  return res;
}
