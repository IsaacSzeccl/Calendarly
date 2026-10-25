import "server-only";
import type { ExplainFacts } from "@/lib/ai/explainText";
import { db, must } from "@/lib/db/client";
import { getGuests, getOptions, getVotes, statusOf, type Guest, type Poll, type PollStatus } from "@/lib/db/polls";
import {
  adviceSentences,
  basisText,
  conditionalAdvice,
  isComplete,
  noClearFit,
  rank,
  type Advice,
  type Assessment,
  type Completion,
} from "@/lib/engine/rank";
import type { Choice, Respondent, SlotOption } from "@/lib/engine/types";
import { slotLabel } from "@/lib/format";
import { guestBusy } from "./guestCalendar";

export type Dashboard = {
  poll: Poll;
  status: PollStatus;
  options: SlotOption[];
  guests: Guest[];
  respondents: Respondent[];
  ranked: Assessment[];
  advice: Advice;
  adviceText: string[];
  completion: Completion;
  basis: string;
  waiting: string[];
  /** Guests whose connected calendar couldn't be read (expired or revoked). */
  needsReconnect: string[];
  noClearFit: boolean;
  failedEmails: number;
  facts: ExplainFacts;
};

/** Load everything for one poll and rank it. Rankings are recomputed on every load, never stored. */
export async function loadDashboard(poll: Poll): Promise<Dashboard> {
  const [options, guests] = await Promise.all([getOptions(poll.id), getGuests(poll.id)]);
  const [votes, statements, failed] = await Promise.all([
    getVotes(options.map((o) => o.id)),
    db().from("statements").select("guest_id").eq("poll_id", poll.id).eq("confirmed", true),
    db().from("email_log").select("id", { count: "exact", head: true }).eq("poll_id", poll.id).eq("result", "failed"),
  ]);
  const statementGuests = new Set(must(statements, "load statements").map((s) => s.guest_id));
  const calendars = await Promise.all(guests.map((g) => guestBusy(g.calendarConnectionId, options)));

  const respondents: Respondent[] = guests.map((g, i) => ({
    id: g.id,
    name: g.name,
    timezone: g.timezone,
    required: false,
    votes: Object.fromEntries(
      votes.filter((v) => v.guestId === g.id).map((v) => [v.optionId, v.choice as Choice]),
    ),
    busy: calendars[i].state === "connected" ? calendars[i].busy : null,
    preferences: g.preferences.map((p) => ({ ...p, appliesTo: g.name })),
    hasStatement: statementGuests.has(g.id),
  }));

  const ctx = { rules: poll.rules, respondents };
  const ranked = rank(options, ctx);
  const answered = new Set(respondents.map((r) => r.name.trim().toLowerCase()));
  const waiting = poll.rules.people.map((p) => p.name).filter((n) => !answered.has(n.trim().toLowerCase()));
  const knownNoWaiting = ranked[0]?.cannotCome.filter((n) => waiting.includes(n)).length ?? 0;
  const advice = conditionalAdvice(ranked, 1 + respondents.length + knownNoWaiting);
  const adviceText = adviceSentences(advice);
  const clearFitMissing = noClearFit(ranked, poll.rules.onlyIfNecessary);

  const organizerSample = poll.organizerCalendar.kind === "sample";
  const basis = basisText({
    connectedCalendars: (organizerSample ? 0 : 1) + respondents.filter((r) => r.busy).length,
    sampleCalendars: organizerSample ? 1 : 0,
    voters: respondents.filter((r) => Object.keys(r.votes).length > 0).length,
    statements: statementGuests.size,
  });

  const zone = poll.rules.organizerTimezone;
  const facts: ExplainFacts = {
    title: poll.title,
    organizerName: poll.organizerName,
    onlyIfNecessary: poll.rules.onlyIfNecessary,
    noClearFit: clearFitMissing,
    noPerfectSlot: advice.noPerfectSlot,
    basis,
    options: ranked.map((a) => ({
      id: a.option.id,
      number: a.number,
      when: slotLabel(a.option.start, a.option.end, zone),
      label: a.label,
      canCome: a.canCome,
      preferNot: a.preferNot,
      cannotCome: a.cannotCome,
      notAnswered: a.unknown,
      reasons: a.penalties.map((p) => p.reason),
    })),
    advice: adviceText,
  };

  return {
    poll,
    status: statusOf(poll),
    options,
    guests,
    respondents,
    ranked,
    advice,
    adviceText,
    completion: isComplete(respondents.length, poll.expectedCount),
    basis,
    waiting,
    needsReconnect: guests.filter((_, i) => calendars[i].state === "needs_reconnect").map((g) => g.name),
    noClearFit: clearFitMissing,
    failedEmails: failed.count ?? 0,
    facts,
  };
}
