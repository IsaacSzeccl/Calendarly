import "server-only";
import { cookies } from "next/headers";
import type { CalendarAccount } from "@/lib/calendar/provider";

export type Organizer = {
  id: string;
  email: string | null;
  name: string;
  /** Where this organizer's free time comes from. */
  calendar: CalendarAccount;
};

export const TEST_COOKIE = "calendarly_test_organizer";

export function testModeOn(): boolean {
  return process.env.E2E_TEST_MODE === "1";
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
        return { ...t, calendar: { kind: "sample", key: "organizer" } };
      } catch {
        // fall through to no session
      }
    }
  }
  return null;
}
