import type { Interval } from "@/lib/engine/types";
import type { CalendarAccount, CalendarProvider, NewEvent } from "./provider";

function keyOf(account: CalendarAccount): string {
  return account.kind === "sample" ? `sample:${account.key}` : `google:${account.connectionId}`;
}

/** In-memory calendar for tests: set busy times per account, read back created events. */
export class FakeCalendarProvider implements CalendarProvider {
  private busy = new Map<string, Interval[]>();
  readonly created: (NewEvent & { account: string })[] = [];

  setBusy(account: CalendarAccount, intervals: Interval[]) {
    this.busy.set(keyOf(account), intervals);
  }

  async getBusy(account: CalendarAccount, from: number, to: number): Promise<Interval[]> {
    return (this.busy.get(keyOf(account)) ?? []).filter((b) => b.end > from && b.start < to);
  }

  async createEvent(account: CalendarAccount, event: NewEvent): Promise<{ id: string }> {
    this.created.push({ ...event, account: keyOf(account) });
    return { id: `fake-${this.created.length}` };
  }
}
