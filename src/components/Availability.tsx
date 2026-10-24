import type { Choice, Status } from "@/lib/engine/types";

export const CHOICES: { value: Choice; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "prefer_not", label: "Prefer not" },
  { value: "no", label: "No" },
];

const look: Record<Status, { on: string; text: string }> = {
  yes: { on: "bg-yes-wash border-yes text-yes", text: "text-yes" },
  prefer_not: { on: "bg-maybe-wash border-maybe text-maybe", text: "text-maybe" },
  no: { on: "bg-no-wash border-no text-no", text: "text-no" },
  unknown: { on: "border-rule text-pencil", text: "text-pencil" },
};

/** Check, tilde-ish wave, cross, dash: each mark has its own shape, not just a color. */
export function StatusIcon({ status, className = "size-4" }: { status: Status; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (status === "yes") return <svg {...common}><path d="M3 8.5l3.2 3L13 4.5" /></svg>;
  if (status === "prefer_not") return <svg {...common}><path d="M2.5 9c1.4-2 2.8-2 4.2 0s2.8 2 4.2 0 1.6-1.6 2.6-1" /></svg>;
  if (status === "no") return <svg {...common}><path d="M4 4l8 8M12 4l-8 8" /></svg>;
  return <svg {...common}><path d="M5 8h6" /></svg>;
}

export function statusText(status: Status): string {
  return status === "unknown" ? "No answer" : CHOICES.find((c) => c.value === status)!.label;
}

/** A small read-only mark: icon plus word. */
export function StatusMark({ status, compact = false }: { status: Status; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 ${look[status].text}`} title={statusText(status)}>
      <StatusIcon status={status} />
      <span className={compact ? "sr-only" : "text-sm"}>{statusText(status)}</span>
    </span>
  );
}

/** Three large buttons: yes / prefer not / no. */
export function ChoicePicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: Choice | undefined;
  onChange: (c: Choice) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {CHOICES.map((c) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(c.value)}
            className={`inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-sm font-medium transition sm:px-3 disabled:opacity-60 ${
              selected ? look[c.value].on : "border-rule bg-paper text-pencil hover:bg-paper-deep"
            }`}
          >
            <StatusIcon status={c.value} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
