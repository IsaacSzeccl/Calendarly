import type { Interval } from "@/lib/engine/types";
import {
  CalendarUnavailableError,
  type CalendarAccount,
  type CalendarProvider,
  type NewEvent,
} from "./provider";

const FREEBUSY = "https://www.googleapis.com/auth/calendar.freebusy";
const EVENTS = "https://www.googleapis.com/auth/calendar.events";

/** Organizers can create the final event; guests only ever share busy times. */
export const SCOPES = { organizer: [FREEBUSY, EVENTS], guest: [FREEBUSY] } as const;

export function authUrl(i: { clientId: string; redirectUri: string; scopes: readonly string[]; state: string }): string {
  const params = new URLSearchParams({
    client_id: i.clientId,
    redirect_uri: i.redirectUri,
    response_type: "code",
    scope: i.scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: i.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type Fetch = typeof fetch;

export async function exchangeCode(
  code: string,
  redirectUri: string,
  f: Fetch = fetch,
): Promise<{ refreshToken: string; scope: string }> {
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token exchange failed: ${json.error ?? res.status}`);
  if (!json.refresh_token) throw new Error("Google did not return a refresh token");
  return { refreshToken: json.refresh_token, scope: json.scope ?? "" };
}

export async function revokeToken(token: string, f: Fetch = fetch): Promise<void> {
  await f(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(
    () => undefined,
  );
}

/** Google's free/busy reply → busy intervals. Only start and end are ever read. */
export function mapFreeBusy(json: unknown, calendarId = "primary"): Interval[] {
  const cal = (json as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> })
    .calendars?.[calendarId];
  if (!cal) throw new CalendarUnavailableError("No free/busy data for this calendar");
  if (cal.errors?.length) throw new CalendarUnavailableError("Google reported an error reading free/busy");
  return (cal.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

export function eventBody(e: NewEvent) {
  return {
    summary: e.title,
    description: e.description,
    start: { dateTime: new Date(e.start).toISOString(), timeZone: e.timezone },
    end: { dateTime: new Date(e.end).toISOString(), timeZone: e.timezone },
  };
}

export type ConnectionStore = {
  /** The decrypted refresh token for a connection, or null if it's gone. */
  refreshToken(connectionId: string): Promise<string | null>;
  markNeedsReconnect(connectionId: string): Promise<void>;
};

/** Real Google Calendar: free/busy for everyone, event creation for the organizer. */
export class GoogleCalendarProvider implements CalendarProvider {
  private tokens = new Map<string, { token: string; expires: number }>();
  private busyCache = new Map<string, { at: number; busy: Interval[] }>();

  constructor(
    private store: ConnectionStore,
    private f: Fetch = fetch,
  ) {}

  private async accessToken(connectionId: string): Promise<string> {
    const cached = this.tokens.get(connectionId);
    if (cached && cached.expires > Date.now() + 60_000) return cached.token;
    const refresh = await this.store.refreshToken(connectionId);
    if (!refresh) throw new CalendarUnavailableError("Calendar is not connected", true);
    const res = await this.f("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refresh,
        grant_type: "refresh_token",
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // invalid_grant: revoked, or the Testing-mode refresh token expired.
      if (json.error === "invalid_grant") await this.store.markNeedsReconnect(connectionId);
      throw new CalendarUnavailableError(`Google refused the calendar token (${json.error ?? res.status})`, true);
    }
    this.tokens.set(connectionId, { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 });
    return json.access_token;
  }

  private connectionId(account: CalendarAccount): string {
    if (account.kind !== "google") throw new Error("Google provider only reads Google calendars");
    return account.connectionId;
  }

  async getBusy(account: CalendarAccount, from: number, to: number): Promise<Interval[]> {
    const id = this.connectionId(account);
    const key = `${id}:${from}:${to}`;
    const hit = this.busyCache.get(key);
    if (hit && hit.at > Date.now() - 60_000) return hit.busy;
    const token = await this.accessToken(id);
    const res = await this.f("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: new Date(from).toISOString(),
        timeMax: new Date(to).toISOString(),
        items: [{ id: "primary" }],
      }),
    });
    if (!res.ok) throw new CalendarUnavailableError(`Google free/busy failed (${res.status})`, res.status === 401);
    const busy = mapFreeBusy(await res.json());
    this.busyCache.set(key, { at: Date.now(), busy });
    return busy;
  }

  async createEvent(account: CalendarAccount, event: NewEvent): Promise<{ id: string }> {
    const token = await this.accessToken(this.connectionId(account));
    const res = await this.f("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(eventBody(event)),
    });
    if (!res.ok) throw new CalendarUnavailableError(`Google could not create the event (${res.status})`);
    return { id: (await res.json()).id };
  }
}
