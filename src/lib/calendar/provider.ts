import type { Interval } from "@/lib/engine/types";

/** Whose calendar: a labeled sample calendar, or a real Google connection. */
export type CalendarAccount =
  | { kind: "sample"; key: string; timezone?: string }
  | { kind: "google"; connectionId: string };

export type NewEvent = {
  title: string;
  start: number;
  end: number;
  timezone: string;
  description?: string;
};

/**
 * The only two questions Calendarly ever asks a calendar.
 * Only busy times are read, never titles or details.
 */
export interface CalendarProvider {
  getBusy(account: CalendarAccount, from: number, to: number): Promise<Interval[]>;
  createEvent(account: CalendarAccount, event: NewEvent): Promise<{ id: string }>;
}

export class CalendarUnavailableError extends Error {
  constructor(
    message: string,
    readonly needsReconnect = false,
  ) {
    super(message);
  }
}
