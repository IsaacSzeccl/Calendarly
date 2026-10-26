"use client";

import { useMemo, useState } from "react";
import { dayLabel, timeRange } from "@/lib/format";
import { Button, Notice, inputClass } from "@/components/ui";

/**
 * Pick a day and a start time from the ones the server says can be added.
 * Always mounted, so its message survives the refresh after an add fills the poll.
 */
export function PickTime({
  token,
  zone,
  starts,
  room,
  durationMinutes,
  ensureSaved,
  onAdded,
}: {
  token: string;
  zone: string;
  /** Null when the organizer's calendar can't be read right now. */
  starts: number[] | null;
  room: number;
  durationMinutes: number;
  ensureSaved: () => Promise<boolean>;
  onAdded: (added: { id: string; start: number; end: number }) => void;
}) {
  const length = durationMinutes * 60_000;
  const byDay = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const t of starts ?? []) groups.set(dayLabel(t, zone), [...(groups.get(dayLabel(t, zone)) ?? []), t]);
    return groups;
  }, [starts, zone]);
  const days = [...byDay.keys()];
  const [pickedDay, setDay] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const day = pickedDay && byDay.has(pickedDay) ? pickedDay : (days[0] ?? "");
  const times = byDay.get(day) ?? [];
  const chosen = start !== null && times.includes(start) ? start : (times[0] ?? null);

  async function add() {
    if (chosen === null) return;
    setBusy(true);
    setMessage(null);
    try {
      if (!(await ensureSaved())) return;
      const res = await fetch("/api/guest/add-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, start: chosen }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "That didn't work. Try again.");
      setMessage({ tone: "info", text: "Your time was added and marked yes." });
      onAdded(json.added);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "That didn't work. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const unavailable =
    room <= 0
      ? "The poll is full."
      : starts === null
        ? "The organizer's calendar can't be checked right now."
        : days.length === 0
          ? "No other times are free for the organizer."
          : null;

  return (
    <div className="space-y-3">
      {unavailable ? (
        <p className="text-sm text-pencil">{unavailable} You can still send a note.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-sm font-medium">Day</span>
            <select className={`${inputClass} w-auto`} value={day} onChange={(e) => setDay(e.target.value)}>
              {days.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium">Time</span>
            <select
              className={`${inputClass} tabular w-auto`}
              value={chosen ?? ""}
              onChange={(e) => setStart(Number(e.target.value))}
            >
              {times.map((t) => (
                <option key={t} value={t}>
                  {timeRange(t, t + length, zone)}
                </option>
              ))}
            </select>
          </label>
          <Button variant="quiet" type="button" onClick={add} disabled={busy || chosen === null}>
            {busy ? "Adding…" : "Add this time"}
          </Button>
        </div>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  );
}
