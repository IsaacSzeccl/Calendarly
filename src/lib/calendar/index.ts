import type { CalendarAccount, CalendarProvider } from "./provider";
import { SeededCalendarProvider } from "./seeded";

const seeded = new SeededCalendarProvider();

/** The provider that can answer for this account. */
export function providerFor(account: CalendarAccount): CalendarProvider {
  if (account.kind === "sample") return seeded;
  throw new Error("Google calendars are connected in a later step");
}
