import { connectionStore } from "@/lib/db/connections";
import { GoogleCalendarProvider } from "./google";
import type { CalendarAccount, CalendarProvider } from "./provider";
import { SeededCalendarProvider } from "./seeded";

const seeded = new SeededCalendarProvider();
const google = new GoogleCalendarProvider(connectionStore);

/** The provider that can answer for this account. Swapping it changes no other code. */
export function providerFor(account: CalendarAccount): CalendarProvider {
  return account.kind === "sample" ? seeded : google;
}
