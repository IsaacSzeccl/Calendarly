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

export async function getGuests(pollId: string): Promise<Guest[]> {
  const rows = must(
    await db().from("guests").select().eq("poll_id", pollId).order("created_at"),
    "load guests",
  );
  return rows.map(toGuest);
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

/**
 * Save a guest's answers. The cookie finds a returning guest; failing that,
 * the same email on the same poll is treated as the same person.
 */
export async function saveResponse(input: {
  pollId: string;
  guestToken: string | null;
  name: string;
  email: string;
  timezone: string;
  votes: Record<string, Choice>;
}): Promise<Guest> {
  let existing = input.guestToken ? await getGuestByToken(input.pollId, input.guestToken) : null;
  if (!existing) {
    const byEmail = maybe(
      await db()
        .from("guests")
        .select()
        .eq("poll_id", input.pollId)
        .ilike("email", input.email.replace(/[%_\\]/g, "\\$&"))
        .maybeSingle(),
      "find guest",
    );
    existing = byEmail ? toGuest(byEmail) : null;
  }

  const fields = { name: input.name, email: input.email, timezone: input.timezone };
  const guest = existing
    ? toGuest(
        must(
          await db()
            .from("guests")
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
            .select()
            .single(),
          "update guest",
        ),
      )
    : toGuest(
        must(
          await db()
            .from("guests")
            .insert({ ...fields, poll_id: input.pollId, guest_token: newToken() })
            .select()
            .single(),
          "add guest",
        ),
      );

  const entries = Object.entries(input.votes);
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
