import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase client for sign-in only (never for data). Reads and writes the session cookies. */
export async function createAuthClient() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Called from a Server Component, which can't set cookies; the proxy refreshes sessions.
        }
      },
    },
  });
}
