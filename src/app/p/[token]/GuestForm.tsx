"use client";

import { useState, useSyncExternalStore } from "react";
import type { Choice, OptionSource } from "@/lib/engine/types";
import { slotLabel, zoneShort } from "@/lib/format";
import { ChoicePicker, StatusMark } from "@/components/Availability";
import { SlotList } from "@/components/SlotList";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export type GuestFormProps = {
  token: string;
  title: string;
  organizerName: string;
  organizerTimezone: string;
  durationMinutes: number;
  status: "open" | "closed" | "finalized";
  closeAt: number | null;
  listedNames: string[];
  options: { id: string; start: number; end: number; source: OptionSource }[];
  finalOption: { start: number; end: number } | null;
  me: { name: string; email: string; timezone: string; votes: Record<string, Choice> } | null;
};

const noop = () => () => {};

/** The viewer's own timezone, read after hydration so server and browser agree. */
function useBrowserZone(fallback: string): string {
  return useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => fallback);
}

export function GuestForm(props: GuestFormProps) {
  const zone = useBrowserZone(props.me?.timezone ?? props.organizerTimezone);
  const [name, setName] = useState(props.me?.name ?? "");
  const [email, setEmail] = useState(props.me?.email ?? "");
  const [votes, setVotes] = useState<Record<string, Choice>>(props.me?.votes ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readOnly = props.status !== "open";
  const nameOptions = props.me && !props.listedNames.includes(props.me.name)
    ? [props.me.name, ...props.listedNames]
    : props.listedNames;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/guest/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, name, email, timezone: zone, votes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Your answers weren't saved. Try again.");
      setSaved(json.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your answers weren't saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const length =
    props.durationMinutes % 60 === 0 ? `${props.durationMinutes / 60}-hour` : `${props.durationMinutes}-minute`;

  return (
    <form onSubmit={submit} className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-4xl">{props.title}</h1>
        <p className="text-pencil">
          {props.organizerName} is finding a time for a {length} meeting. Times are shown in{" "}
          {zoneShort(zone)}.
        </p>
      </header>

      {props.status === "finalized" && props.finalOption && (
        <Notice>
          {props.organizerName} picked {slotLabel(props.finalOption.start, props.finalOption.end, zone)}.
        </Notice>
      )}
      {props.status === "closed" && (
        <Notice>This poll has closed. Your answers below are saved and can't be changed.</Notice>
      )}

      <section className="space-y-4" aria-labelledby="who">
        <h2 id="who" className="text-2xl">
          Who are you?
        </h2>
        {nameOptions.length > 0 && (
          <div className="space-y-2">
            <span className="block text-sm font-medium">Pick your name</span>
            <div className="flex flex-wrap gap-2">
              {nameOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={name === n}
                  onClick={() => setName(n)}
                  className={`min-h-11 rounded-md border px-4 font-medium ${
                    name === n ? "border-ribbon bg-paper-deep text-ink" : "border-rule text-pencil hover:bg-paper-deep"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={nameOptions.length ? "Or type your name" : "Your name"}>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={readOnly}
              autoComplete="name"
              required
            />
          </Field>
          <Field label="Email" hint="Only used to tell you about new times and the final time.">
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={readOnly}
              autoComplete="email"
              required
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="times">
        <div>
          <h2 id="times" className="text-2xl">
            Which times work?
          </h2>
          <p className="text-pencil">Mark each one. "Prefer not" means you could, but would rather not.</p>
        </div>
        <SlotList
          slots={props.options}
          zone={zone}
          extra={(slot) =>
            readOnly ? (
              <StatusMark status={votes[slot.id!] ?? "unknown"} />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {slot.source === "ai_added" && <span className="text-sm text-pencil">Added from a suggestion</span>}
                <ChoicePicker
                  label={`Your answer for ${slotLabel(slot.start, slot.end, zone)}`}
                  value={votes[slot.id!]}
                  onChange={(c) => {
                    setVotes((v) => ({ ...v, [slot.id!]: c }));
                    setSaved(null);
                  }}
                />
              </div>
            )
          }
        />
      </section>

      {!readOnly && (
        <div className="space-y-3">
          {error && <Notice tone="error">{error}</Notice>}
          {saved && (
            <Notice>
              Thanks, {saved}. Your answers are saved. You can come back to this link and change them until{" "}
              {props.organizerName} picks a time.
            </Notice>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : props.me || saved ? "Save my changes" : "Send my answers"}
          </Button>
        </div>
      )}
    </form>
  );
}
