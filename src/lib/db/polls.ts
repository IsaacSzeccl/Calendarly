import "server-only";
import { randomBytes } from "node:crypto";
import type { CalendarAccount } from "@/lib/calendar/provider";
import type { Choice, Constraint, Interval, OptionSource, PollRules, SlotOption } from "@/lib/engine/types";
import { db, maybe, must, ok } from "./client";
import type { Database, Json, Row } from "./database.types";

export type PollStatus = "open" | "closed" | "finalized";

export type Poll = {
  id: string;
  organizerId: string;
  organizerEmail: string | null;
  organizerName: string;
  title: string;
  rules: PollRules;
  expectedCount: number;
  organizerCalendar: CalendarAccount;
  closeAt: number | null;
  storedStatus: PollStatus;
  shareToken: string;
  finalOptionId: string | null;
  googleEventId: string | null;
  updateSentAt: number | null;
  createdAt: number;
};

export type Guest = {
  id: string;
  pollId: string;
  name: string;
  email: string;
  timezone: string;
  guestToken: string;
  preferencesSummary: string | null;
  preferences: Constraint[];
  calendarConnectionId: string | null;
  remember: boolean;
  /** Single-use code for the guest's private link, while one is outstanding. */
  claimToken: string | null;
  /** Pressed Save / Send. Until then the guest only exists so a calendar can be attached. */
  submitted: boolean;
  /** A seeded demo guest with made-up answers. */
  isSample: boolean;
};

export type Vote = { optionId: string; guestId: string; choice: Choice };

/** A random URL-safe token: the poll link, and the guest's private cookie. */
export function newToken(): string {
  return randomBytes(18).toString("base64url");
}

const ms = (t: string | null) => (t ? Date.parse(t) : null);

function toPoll(r: Row<"polls">): Poll {
  return {
    id: r.id,
    organizerId: r.organizer_id,
    organizerEmail: r.organizer_email,
    organizerName: r.organizer_name,
    title: r.title,
    rules: r.rules as unknown as PollRules,
    expectedCount: r.expected_count,
    organizerCalendar: r.organizer_calendar as unknown as CalendarAccount,
    closeAt: ms(r.close_at),
    storedStatus: r.status as PollStatus,
    shareToken: r.share_token,
    finalOptionId: r.final_option_id,
    googleEventId: r.google_event_id,
    updateSentAt: ms(r.update_sent_at),
    createdAt: Date.parse(r.created_at),
  };
}

function toOption(r: Row<"options">): SlotOption {
  return {
    id: r.id,
    start: Date.parse(r.starts_at),
    end: Date.parse(r.ends_at),
    source: r.source as OptionSource,
  };
}

function toGuest(r: Row<"guests">): Guest {
  return {
    id: r.id,
    pollId: r.poll_id,
    name: r.name,
    email: r.email,
    timezone: r.timezone,
    guestToken: r.guest_token,
    preferencesSummary: r.preferences_summary,
    preferences: (r.preferences ?? []) as unknown as Constraint[],
    calendarConnectionId: r.calendar_connection_id,
    remember: r.remember,
    claimToken: r.claim_token,
    submitted: r.submitted_at !== null,
    isSample: r.is_sample,
  };
}

/** Closing is checked on every request: a poll past its close time counts as closed. */
export function statusOf(poll: Poll, now: number = Date.now()): PollStatus {
  if (poll.storedStatus === "open" && poll.closeAt !== null && poll.closeAt <= now) return "closed";
  return poll.storedStatus;
}

export async function createPoll(input: {
  organizer: { id: string; email: string | null; name: string };
  title: string;
  rules: PollRules;
  expectedCount: number;
  calendar: CalendarAccount;
  closeAt: number | null;
  options: Interval[];
}): Promise<Poll> {
  const row = must(
    await db()
      .from("polls")
      .insert({
        organizer_id: input.organizer.id,
        organizer_email: input.organizer.email,
        organizer_name: input.organizer.name,
        title: input.title,
        rules: input.rules as unknown as Json,
        expected_count: input.expectedCount,
        organizer_calendar: input.calendar as unknown as Json,
        close_at: input.closeAt ? new Date(input.closeAt).toISOString() : null,
        share_token: newToken(),
      })
      .select()
      .single(),
    "create poll",
  );
  if (input.options.length) {
    await addOptions(row.id, input.options, "organizer_free");
  }
  return toPoll(row);
}

export async function addOptions(
  pollId: string,
  slots: Interval[],
  source: OptionSource,
  statementId: string | null = null,
): Promise<SlotOption[]> {
  const rows = must(
    await db()
      .from("options")
      .insert(
        slots.map((s) => ({
          poll_id: pollId,
          starts_at: new Date(s.start).toISOString(),
          ends_at: new Date(s.end).toISOString(),
          source,
          added_by_statement_id: statementId,
        })),
      )
      .select(),
    "add options",
  );
  return rows.map(toOption);
}

/**
 * Add a time a guest suggested: from their typed statement, their calendar, or picked by hand.
 * Returns null when the database refuses it: a duplicate, or the poll's cap is reached.
 */
export async function addGuestOption(
  pollId: string,
  slot: Interval,
  from: { statementId: string } | "guest",
): Promise<SlotOption | null> {
  const result = await db()
    .from("options")
    .insert({
      poll_id: pollId,
      starts_at: new Date(slot.start).toISOString(),
      ends_at: new Date(slot.end).toISOString(),
      source: from === "guest" ? "guest_added" : "ai_added",
      added_by_statement_id: from === "guest" ? null : from.statementId,
    })
    .select()
    .single();
  if (result.error?.code === "23505" || result.error?.code === "P0001") return null;
  return toOption(must(result, "add suggested time"));
}

export async function getPollByToken(token: string): Promise<Poll | null> {
  const row = maybe(
    await db().from("polls").select().eq("share_token", token).maybeSingle(),
    "load poll",
  );
  return row ? toPoll(row) : null;
}

export async function getPoll(id: string): Promise<Poll | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = maybe(await db().from("polls").select().eq("id", id).maybeSingle(), "load poll");
  return row ? toPoll(row) : null;
}

export async function listPollsFor(organizerId: string): Promise<Poll[]> {
  const rows = must(
    await db()
      .from("polls")
      .select()
      .eq("organizer_id", organizerId)
      .order("created_at", { ascending: false })
      .limit(20),
    "list polls",
  );
  return rows.map(toPoll);
}

export async function getOptions(pollId: string): Promise<SlotOption[]> {
  const rows = must(
    await db().from("options").select().eq("poll_id", pollId).order("starts_at"),
    "load options",
  );
  return rows.map(toOption);
}

/** Everyone on the poll, or with `answeredOnly` just those who pressed Save / Send. */
export async function getGuests(pollId: string, answeredOnly = false): Promise<Guest[]> {
  const rows = must(
    await db().from("guests").select().eq("poll_id", pollId).order("created_at"),
    "load guests",
  );
  const guests = rows.map(toGuest);
  return answeredOnly ? guests.filter((g) => g.submitted) : guests;
}

export async function getGuestByToken(pollId: string, guestToken: string): Promise<Guest | null> {
  const row = maybe(
    await db()
      .from("guests")
      .select()
      .eq("poll_id", pollId)
      .eq("guest_token", guestToken)
      .maybeSingle(),
    "load guest",
  );
  return row ? toGuest(row) : null;
}

export async function getVotes(optionIds: string[]): Promise<Vote[]> {
  if (optionIds.length === 0) return [];
  const rows = must(
    await db().from("votes").select("option_id, guest_id, choice").in("option_id", optionIds),
    "load votes",
  );
  return rows.map((r) => ({ optionId: r.option_id, guestId: r.guest_id, choice: r.choice as Choice }));
}

/** Another guest on this poll already answered with this email. */
export class EmailTakenError extends Error {}

/**
 * Save a guest. Only the private cookie identifies a returning guest: an email
 * alone never unlocks someone else's answers or calendar.
 *
 * With `submit` (the Save / Send button) the answers are stored and the guest
 * counts as answered. Without it only who they are is stored, so a calendar can
 * be attached or a time added, and nothing counts yet.
 */
export async function saveResponse(input: {
  pollId: string;
  guestToken: string | null;
  name: string;
  email: string;
  timezone: string;
  votes: Record<string, Choice>;
  submit: boolean;
}): Promise<Guest> {
  const existing = input.guestToken ? await getGuestByToken(input.pollId, input.guestToken) : null;
  const fields = { name: input.name, email: input.email, timezone: input.timezone };
  const now = new Date().toISOString();
  const result = existing
    ? await db()
        .from("guests")
        .update({
          ...fields,
          updated_at: now,
          // The first Save is when they became an answer; later saves keep that moment.
          ...(input.submit && !existing.submitted ? { submitted_at: now } : {}),
        })
        .eq("id", existing.id)
        .select()
        .single()
    : await db()
        .from("guests")
        .insert({
          ...fields,
          poll_id: input.pollId,
          guest_token: newToken(),
          submitted_at: input.submit ? now : null,
        })
        .select()
        .single();
  // guests_poll_email_idx: one answer per email per poll.
  if (result.error?.code === "23505") throw new EmailTakenError();
  const guest = toGuest(must(result, existing ? "update guest" : "add guest"));

  // Answers are only stored on an explicit Save: the form may be showing a calendar's prefilled marks.
  const entries = input.submit ? Object.entries(input.votes) : [];
  if (entries.length) {
    ok(
      await db()
        .from("votes")
        .upsert(
          entries.map(([optionId, choice]) => ({
            option_id: optionId,
            guest_id: guest.id,
            choice,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "option_id,guest_id" },
        ),
      "save votes",
    );
  }
  return guest;
}

export async function updatePoll(
  id: string,
  fields: Database["public"]["Tables"]["polls"]["Update"],
): Promise<void> {
  ok(await db().from("polls").update(fields).eq("id", id), "update poll");
}

/**
 * The guest's "remember me for future meetings with this organizer" choice.
 * Saying no reaches every poll this calendar was brought into, so no earlier
 * poll can bring them along again.
 */
export async function setRemember(guest: Guest, remember: boolean): Promise<void> {
  const update = db().from("guests").update({ remember });
  ok(
    !remember && guest.calendarConnectionId
      ? await update.eq("calendar_connection_id", guest.calendarConnectionId)
      : await update.eq("id", guest.id),
    "save remember me",
  );
}

/** A fresh single-use code for this guest's private link. */
export async function issueClaimToken(guestId: string): Promise<string> {
  const claim = newToken();
  ok(await db().from("guests").update({ claim_token: claim }).eq("id", guestId), "issue private link");
  return claim;
}

/** Use up a private-link code: returns that guest's token once, then never again. */
export async function takeClaim(pollId: string, claim: string): Promise<string | null> {
  const row = maybe(
    await db()
      .from("guests")
      .update({ claim_token: null })
      .eq("poll_id", pollId)
      .eq("claim_token", claim)
      .select("guest_token")
      .maybeSingle(),
    "use private link",
  );
  return row?.guest_token ?? null;
}

export async function getGuestByEmail(pollId: string, email: string): Promise<Guest | null> {
  const row = maybe(
    await db()
      .from("guests")
      .select()
      .eq("poll_id", pollId)
      // Matches guests_poll_email_idx (lower(email)); wildcards in the address are escaped.
      .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
      .maybeSingle(),
    "find guest by email",
  );
  return row ? toGuest(row) : null;
}

/** Disconnecting a calendar also withdraws "remember me" everywhere that calendar was used. */
export async function forgetConnection(connectionId: string): Promise<void> {
  ok(
    await db().from("guests").update({ remember: false }).eq("calendar_connection_id", connectionId),
    "withdraw remember me",
  );
}

/** Meet again: the same person in a new poll, with their calendar and consent, and a fresh private token. */
export async function copyGuestInto(pollId: string, g: Guest): Promise<Guest> {
  return toGuest(
    must(
      await db()
        .from("guests")
        .insert({
          poll_id: pollId,
          name: g.name,
          email: g.email,
          timezone: g.timezone,
          guest_token: newToken(),
          claim_token: newToken(),
          submitted_at: new Date().toISOString(),
          calendar_connection_id: g.calendarConnectionId,
          remember: true,
        })
        .select()
        .single(),
      "copy guest",
    ),
  );
}
