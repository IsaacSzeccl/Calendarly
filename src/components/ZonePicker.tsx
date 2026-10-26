"use client";

import { inputClass } from "./ui";

// A fixed list, so the server and the browser render exactly the same options.
const COMMON = [
  "UTC",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const city = (zone: string) => zone.split("/").pop()!.replace(/_/g, " ");

/** Show times in another timezone, e.g. the one a calendar uses, to compare them side by side. */
export function ZonePicker({
  zone,
  also,
  onChange,
}: {
  zone: string;
  /** Zones worth offering first, such as the organizer's. */
  also: string[];
  onChange: (zone: string) => void;
}) {
  const zones = [...new Set([zone, ...also, ...COMMON])];
  return (
    <label className="inline-flex items-center gap-2 text-sm text-pencil">
      Times in
      <select
        className={`${inputClass} min-h-9 w-auto py-1 text-base text-ink`}
        value={zone}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Timezone for the times"
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {city(z)}
          </option>
        ))}
      </select>
    </label>
  );
}
