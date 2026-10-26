import "server-only";
import { cookies } from "next/headers";
import type { CalendarAccount } from "@/lib/calendar/provider";
import { dbConfigured } from "@/lib/db/client";
import { findConnection } from "@/lib/db/connections";
import { createAuthClient } from "@/lib/supabase/server";

export type Organizer = {
  id: string;
  email: string | null;
  name: string;
  /** Where this organizer's free time comes from; null until they connect Google Calendar. */
  calendar: CalendarAccount | null;
  /** True when the connected calendar's token expired or was revoked. */
  calendarNeedsReconnect: boolean;
  isTest: boolean;
};

export const TEST_COOKIE = "calendarly_test_organizer";

/** The test-only sign-in. Never on in a Vercel production deployment, whatever the setting. */
export function testModeOn(): boolean {
  return process.env.E2E_TEST_MODE === "1" && process.env.VERCEL_ENV !== "production";
}

/**
 * The signed-in organizer, or null. Anyone else (guests included) gets null,
 * so only the organizer can see a dashboard or pick a slot.
 */
export async function getOrganizer(): Promise<Organizer | null> {
  const jar = await cookies();
  if (testModeOn()) {
    const raw = jar.get(TEST_COOKIE)?.value;
    if (raw) {
      try {
        const t = JSON.parse(raw) as { id: string; name: string; email: string | null };
        // The cookie is unsigned, so it may only ever name a test organizer, never a real one.
        if (typeof t.id !== "string" || !t.id.startsWith("test:")) throw new Error("not a test id");
        return { ...t, calendar: { kind: "sample", key: "organizer" }, calendarNeedsReconnect: false, isTest: true };
      } catch {
        // fall through to a real session
      }
    }
  }
  if (!dbConfigured()) return null;

  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const meta = (claims.user_metadata ?? {}) as { full_name?: string; name?: string };
  const email = (claims.email as string | undefined) ?? null;
  const connection = await findConnection("organizer", claims.sub);
  return {
    id: claims.sub,
    email,
    name: meta.full_name || meta.name || email?.split("@")[0] || "Organizer",
    calendar: connection?.status === "active" ? { kind: "google", connectionId: connection.id } : null,
    calendarNeedsReconnect: connection?.status === "needs_reconnect",
    isTest: false,
  };
}
