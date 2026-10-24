import { NextResponse, type NextRequest } from "next/server";
import { TEST_COOKIE, testModeOn } from "@/lib/auth/organizer";

/**
 * A sign-in that exists only when E2E_TEST_MODE=1, for automated tests and
 * local runs without Google. Signs in as a test organizer with a sample calendar.
 */
export function GET(request: NextRequest) {
  if (!testModeOn()) return new NextResponse("Not found", { status: 404 });
  const params = request.nextUrl.searchParams;
  const name = params.get("name") || "Alex (test organizer)";
  const email = params.get("email") || null;
  const id = `test:${(email ?? name).toLowerCase()}`;
  const next = params.get("next") || "/new";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/new";
  const res = NextResponse.redirect(new URL(safeNext, request.url));
  res.cookies.set(TEST_COOKIE, JSON.stringify({ id, name, email }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
