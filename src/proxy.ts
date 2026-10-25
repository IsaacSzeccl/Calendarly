import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the organizer's Supabase session fresh on each request. It never
 * blocks a page: guests have no session, and pages check access themselves.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  // Refreshes the session if needed. Nothing may run between creating the client and this call.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Only organizer pages and auth routes need the session; guest pages and APIs skip it.
  matcher: ["/", "/new", "/poll/:path*", "/auth/:path*", "/api/polls/:path*", "/api/calendar/:path*"],
};
