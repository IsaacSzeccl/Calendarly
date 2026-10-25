"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusIcon } from "@/components/Availability";
import { SlotList } from "@/components/SlotList";
import { Button, Notice } from "@/components/ui";

export type CalendarState = {
  state: "connected" | "needs_reconnect" | "none";
  sample: boolean;
  marks: Record<string, "yes" | "no">;
  /** New times that fit this guest's calendar and the organizer's; "full" when the poll can't take more. */
  suggestions: { start: number; end: number }[] | "full" | null;
};

const CALENDAR_RESULT: Record<string, string> = {
  connected: "Your calendar is connected. Your answers below are filled in from when you're busy; change any of them.",
  declined: "Calendar access wasn't given. You can still answer by hand.",
  failed: "Connecting your calendar didn't work. You can try again or answer by hand.",
  "save-first": "Add your name and email first, then connect your calendar.",
};

/**
 * Connecting a calendar is the most useful thing a guest can do, so it sits
 * above the times and says plainly what it does for them. Once connected, it
 * offers new times that fit both their calendar and the organizer's.
 */
export function CalendarCard({
  token,
  zone,
  organizerName,
  calendar,
  calendarResult,
  othersConnected,
  testMode,
  remember: savedRemember,
  ensureSaved,
  onAdded,
}: {
  token: string;
  zone: string;
  organizerName: string;
  calendar: CalendarState;
  calendarResult: string | null;
  othersConnected: number;
  testMode: boolean;
  /** "Remember me for future meetings with this organizer", as saved. */
  remember: boolean;
  ensureSaved: () => Promise<boolean>;
  onAdded: (added: { id: string; start: number; end: number }) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [remember, setRemember] = useState(savedRemember);
  const organizerFirst = organizerName.split(" ")[0];

  async function connect(sample: boolean) {
    setBusy(sample ? "sample" : "google");
    // Saving first gives the calendar someone to belong to.
    if (!(await ensureSaved())) return setBusy(null);
    // A full navigation: this API route redirects on to Google's consent screen.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/calendar/connect?for=guest&token=${token}${sample ? "&sample=1" : ""}`);
  }

  async function disconnect() {
    setBusy("disconnect");
    await fetch("/api/calendar/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ for: "guest", token }),
    });
    router.replace(`/p/${token}`);
    router.refresh();
  }

  async function toggleRemember(next: boolean) {
    setRemember(next);
    setError(null);
    const res = await fetch("/api/guest/remember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, remember: next }),
    });
    if (!res.ok) {
      setRemember(!next);
      setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
    }
  }

  async function add(start: number) {
    setBusy(`add-${start}`);
    setError(null);
    try {
      const res = await fetch("/api/guest/calendar-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, start }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "That didn't work. Try again.");
      setAdded("Added to the poll and marked yes for you. Everyone who already answered will get an email.");
      onAdded(json.added);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const result = calendarResult && CALENDAR_RESULT[calendarResult] && (
    <Notice tone={calendarResult === "connected" ? "info" : "error"}>{CALENDAR_RESULT[calendarResult]}</Notice>
  );

  if (calendar.state === "connected") {
    const list = calendar.suggestions;
    return (
      <section aria-labelledby="calendar" className="space-y-4 rounded-md border border-yes/40 bg-yes-wash/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id="calendar" className="text-2xl">
              Your calendar is answering
            </h2>
            <p className="text-pencil">
              {calendar.sample ? "A sample calendar (test mode) is connected. " : "Your Google Calendar is connected. "}
              The times below are filled in from when you're busy. Only busy or free is read, never your events.
            </p>
          </div>
          <Button variant="plain" type="button" disabled={busy !== null} onClick={disconnect}>
            {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
        {calendarResult !== "connected" && result}

        <label className="flex cursor-pointer gap-3 rounded-md border border-rule bg-paper p-3">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-ribbon"
            checked={remember}
            onChange={(e) => toggleRemember(e.target.checked)}
          />
          <span>
            <span className="block font-medium">Remember me for future meetings with {organizerFirst}</span>
            <span className="block text-sm text-pencil">
              Next time {organizerFirst} meets this group, your calendar answers for you and you get a link to check
              it. Untick this or disconnect any time to stop.
            </span>
          </span>
        </label>

        {list === "full" && (
          <p className="text-sm text-pencil">This poll already has as many suggested times as it can take.</p>
        )}
        {Array.isArray(list) && list.length === 0 && (
          <p className="text-sm text-pencil">
            No other times inside the poll's dates fit both your calendar and {organizerFirst}'s.
          </p>
        )}
        {Array.isArray(list) && list.length > 0 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xl">More times that fit your calendar</h3>
              <p className="text-sm text-pencil">
                Free for you and {organizerFirst}
                {othersConnected > 0 && ", and best for the others who connected a calendar"}. Add one if the times
                below don't suit you.
              </p>
            </div>
            <SlotList
              slots={list}
              zone={zone}
              extra={(slot) => (
                <Button
                  variant="quiet"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => add(slot.start)}
                >
                  {busy === `add-${slot.start}` ? "Adding…" : "Add to the poll"}
                </Button>
              )}
            />
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {added && <Notice>{added}</Notice>}
      </section>
    );
  }

  const reconnect = calendar.state === "needs_reconnect";
  return (
    <section aria-labelledby="calendar" className="space-y-4 rounded-md border border-ribbon/40 bg-paper-deep p-5">
      <div className="space-y-1">
        <h2 id="calendar" className="text-2xl">
          {reconnect ? "Reconnect your calendar" : "Let your calendar answer for you"}
        </h2>
        <p className="text-pencil">
          {reconnect
            ? "Your calendar connection expired. Reconnect to keep your answers and suggestions up to date."
            : "The quickest way to answer, and the most accurate one:"}
        </p>
      </div>
      {!reconnect && (
        <ul className="space-y-2">
          {[
            "Every time below is filled in for you in one step.",
            `If none of them work, you'll get new times that fit both your calendar and ${organizerFirst}'s.`,
            `${organizerFirst} can see who really can come, so you're less likely to end up with a time you can't make.`,
            `Next time ${organizerFirst} meets this group, your calendar can answer for you, if you choose.`,
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-1 text-yes">
                <StatusIcon status="yes" />
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
      {othersConnected > 0 && !reconnect && (
        <p className="text-sm">
          {othersConnected === 1 ? "1 other person has" : `${othersConnected} other people have`} already connected
          theirs.
        </p>
      )}
      {result}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" disabled={busy !== null} onClick={() => connect(false)}>
          {busy === "google" ? "Opening Google…" : reconnect ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </Button>
        {testMode && (
          <button
            type="button"
            className="text-sm underline underline-offset-4"
            disabled={busy !== null}
            onClick={() => connect(true)}
          >
            Use a sample calendar (test mode)
          </button>
        )}
      </div>
      <p className="text-sm text-pencil">
        Only busy or free is read, never what your events are. You can disconnect any time, or answer by hand below.
      </p>
    </section>
  );
}
