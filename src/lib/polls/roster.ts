import type { PollRules } from "@/lib/engine/types";

type RosterGuest = {
  name: string;
  email: string;
  remember: boolean;
  calendarConnectionId: string | null;
  isSample: boolean;
};

/**
 * Who "New meeting with this group" brings along: only guests who ticked
 * "remember me" and still have a calendar connected, because their calendar is
 * what answers for them. Sample guests are made up, so they never come along.
 * One person per email address.
 */
export function whoComesAlong<G extends RosterGuest>(guests: G[]): G[] {
  const seen = new Set<string>();
  return guests.filter((g) => {
    const key = g.email.trim().toLowerCase();
    if (!g.remember || !g.calendarConnectionId || g.isSample || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Add people who come along to the new poll's list, unless the organizer already named them. */
export function withPeople(rules: PollRules, people: { name: string; timezone: string }[]): PollRules {
  const named = new Set(rules.people.map((p) => p.name.trim().toLowerCase()));
  const extra = people
    .filter((p) => !named.has(p.name.trim().toLowerCase()))
    .map((p) => ({ name: p.name, timezone: p.timezone, required: false }));
  return { ...rules, people: [...rules.people, ...extra] };
}
