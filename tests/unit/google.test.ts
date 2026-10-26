import { describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken } from "@/lib/calendar/crypto";
import { GoogleCalendarProvider, SCOPES, authUrl, eventBody, mapFreeBusy } from "@/lib/calendar/google";
import { CalendarUnavailableError } from "@/lib/calendar/provider";

describe("token encryption", () => {
  it("round-trips and never stores the token in plain text", () => {
    const stored = encryptToken("1//refresh-token", "secret");
    expect(stored).not.toContain("refresh-token");
    expect(decryptToken(stored, "secret")).toBe("1//refresh-token");
  });

  it("refuses a token encrypted with another key", () => {
    expect(() => decryptToken(encryptToken("x", "a"), "b")).toThrow();
  });
});

describe("OAuth URL", () => {
  it("asks guests for free/busy only, and organizers for free/busy plus events", () => {
    expect(SCOPES.guest).toEqual(["https://www.googleapis.com/auth/calendar.freebusy"]);
    const url = new URL(authUrl({ clientId: "cid", redirectUri: "http://localhost:3000/api/calendar/callback", scopes: SCOPES.organizer, state: "s" }));
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events",
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("s");
  });
});

describe("mapFreeBusy and eventBody", () => {
  it("reads only start and end of busy blocks", () => {
    const busy = mapFreeBusy({
      calendars: { primary: { busy: [{ start: "2026-11-02T09:00:00Z", end: "2026-11-02T10:00:00Z" }] } },
    });
    expect(busy).toEqual([{ start: Date.parse("2026-11-02T09:00:00Z"), end: Date.parse("2026-11-02T10:00:00Z") }]);
  });

  it("treats a per-calendar error as unavailable", () => {
    expect(() => mapFreeBusy({ calendars: { primary: { errors: [{ reason: "notFound" }] } } })).toThrow(
      CalendarUnavailableError,
    );
  });

  it("creates an event with the organizer's timezone", () => {
    expect(eventBody({ title: "Sync", start: 0, end: 3_600_000, timezone: "Asia/Hong_Kong" })).toEqual({
      summary: "Sync",
      description: undefined,
      start: { dateTime: "1970-01-01T00:00:00.000Z", timeZone: "Asia/Hong_Kong" },
      end: { dateTime: "1970-01-01T01:00:00.000Z", timeZone: "Asia/Hong_Kong" },
    });
  });
});

describe("GoogleCalendarProvider", () => {
  const account = { kind: "google" as const, connectionId: "c1" };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("refreshes the access token, then asks Google for free/busy", async () => {
    const f = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("oauth2")
        ? json({ access_token: "at", expires_in: 3600 })
        : json({ calendars: { primary: { busy: [{ start: "2026-11-02T09:00:00Z", end: "2026-11-02T10:00:00Z" }] } } }),
    );
    const store = { refreshToken: vi.fn(async () => "rt"), markNeedsReconnect: vi.fn(async () => {}) };
    const p = new GoogleCalendarProvider(store, f as unknown as typeof fetch);
    const busy = await p.getBusy(account, 0, 1);
    expect(busy).toHaveLength(1);
    const [, init] = f.mock.calls[1] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer at");
  });

  it("flags the connection for reconnecting when Google says invalid_grant", async () => {
    const f = vi.fn(async () => json({ error: "invalid_grant" }, 400));
    const store = { refreshToken: vi.fn(async () => "rt"), markNeedsReconnect: vi.fn(async () => {}) };
    const p = new GoogleCalendarProvider(store, f as unknown as typeof fetch);
    await expect(p.getBusy(account, 0, 1)).rejects.toMatchObject({ needsReconnect: true });
    expect(store.markNeedsReconnect).toHaveBeenCalledWith("c1");
  });

  it("is unavailable when the connection was removed", async () => {
    const store = { refreshToken: vi.fn(async () => null), markNeedsReconnect: vi.fn(async () => {}) };
    const p = new GoogleCalendarProvider(store, vi.fn() as unknown as typeof fetch);
    await expect(p.getBusy(account, 0, 1)).rejects.toBeInstanceOf(CalendarUnavailableError);
  });
});
