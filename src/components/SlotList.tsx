import type { ReactNode } from "react";
import { groupByDay, timeRange } from "@/lib/format";

type Slot = { start: number; end: number; id?: string };

/**
 * Times laid out like a diary page: the day in the margin, one ruled line
 * per time. Never a calendar grid.
 */
export function SlotList<T extends Slot>({
  slots,
  zone,
  extra,
}: {
  slots: T[];
  zone: string;
  /** Anything to show on the right of a time: votes, labels, actions. */
  extra?: (slot: T, index: number) => ReactNode;
}) {
  const ordered = [...slots].sort((a, b) => a.start - b.start);
  return (
    <div className="border-t border-rule">
      {groupByDay(ordered, zone).map((group) => (
        <div key={group.day} className="grid grid-cols-[5.5rem_1fr] border-b border-rule sm:grid-cols-[7rem_1fr]">
          <div className="py-3 pr-3 font-serif text-[0.95rem] text-pencil">{group.day}</div>
          <ul className="divide-y divide-rule border-l border-rule">
            {group.items.map((slot) => (
              <li
                key={slot.id ?? slot.start}
                className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2"
              >
                <span className="tabular font-medium">{timeRange(slot.start, slot.end, zone)}</span>
                {extra?.(slot, ordered.indexOf(slot))}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
