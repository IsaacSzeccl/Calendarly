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
  /** The busy blocks inside each time marked "no", for showing why. */
  busy: Record<string, { start: number; end: number }[]>;
  /** New times that fit this guest's calendar and the organizer's; "full" when the poll can't take more. */
  suggestions: { start: number; end: number }[] | "full" | null;
};

const CALENDAR_RESULT: Record<string, string> = {
  connected: "Calendar connected.",
  declined: "Calendar access wasn't given. You can answer by hand.",
  failed: "Connecting didn't work. Try again, or answer by hand.",
  "save-first": "Add your name and email first.",
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
  submitted,
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
  /** Has the guest pressed Send / Save yet? Until then nothing from the calendar counts. */
  submitted: boolean;
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
      setAdded("Added, and marked yes for you.");
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
            <p className="text-sm text-pencil">
              {calendar.sample ? "Sample calendar (test mode). " : ""}Only free or busy is read.
              {!submitted && " Nothing is sent until you press the button below."}
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
            <span className="block font-medium">Remember me for {organizerFirst}'s next meetings</span>
            <span className="block text-sm text-pencil">Your calendar answers for you next time.</span>
          </span>
        </label>

        {list === "full" && (
          <p className="text-sm text-pencil">The poll is full, so no more times can be added.</p>
        )}
        {Array.isArray(list) && list.length === 0 && (
          <p className="text-sm text-pencil">No other times suit both you and {organizerFirst}.</p>
        )}
        {Array.isArray(list) && list.length > 0 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xl">More times that suit you</h3>
              <p className="text-sm text-pencil">
                Free for you and {organizerFirst}
                {othersConnected > 0 && ", best for the others too"}.
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
          {reconnect ? "Reconnect your calendar" : "Answer with your calendar"}
        </h2>
        {reconnect && <p className="text-pencil">Your calendar connection expired.</p>}
      </div>
      {!reconnect && (
        <ul className="space-y-2">
          {[
            "Fills in every answer for you",
            "Suggests times that suit you",
            "Can answer for you next time",
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
          {othersConnected === 1 ? "1 person has" : `${othersConnected} people have`} already connected.
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
      <p className="text-sm text-pencil">Only free or busy is read. Disconnect any time.</p>
    </section>
  );
}
