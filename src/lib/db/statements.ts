import "server-only";
import type { Interpretation } from "@/lib/ai/parseStatement";
import type { Choice, Constraint, Interval } from "@/lib/engine/types";
import { db, maybe, must, ok } from "./client";
import type { Json } from "./database.types";

export type Statement = {
  id: string;
  pollId: string;
  guestId: string | null;
  text: string;
  interpretation: Interpretation | null;
  confirmed: boolean;
};

export async function createStatement(i: {
  pollId: string;
  guestId: string;
  text: string;
  interpretation: Interpretation;
}): Promise<string> {
  const row = must(
    await db()
      .from("statements")
      .insert({
        poll_id: i.pollId,
        guest_id: i.guestId,
        text: i.text,
        interpretation: i.interpretation as unknown as Json,
      })
      .select("id")
      .single(),
    "save statement",
  );
  return row.id;
}

export async function getStatement(id: string): Promise<Statement | null> {
  const row = maybe(await db().from("statements").select().eq("id", id).maybeSingle(), "load statement");
  if (!row) return null;
  return {
    id: row.id,
    pollId: row.poll_id,
    guestId: row.guest_id,
    text: row.text,
    interpretation: row.interpretation as unknown as Interpretation | null,
    confirmed: row.confirmed,
  };
}

/** Mark confirmed, but only once: a second confirm of the same statement does nothing. */
export async function claimConfirmation(id: string, ranges: Interval[]): Promise<boolean> {
  const row = maybe(
    await db()
      .from("statements")
      .update({ confirmed: true, confirmed_ranges: ranges as unknown as Json })
      .eq("id", id)
      .eq("confirmed", false)
      .select("id")
      .maybeSingle(),
    "confirm statement",
  );
  return row !== null;
}

export async function setGuestPreferences(guestId: string, summary: string | null, prefs: Constraint[]) {
  ok(
    await db()
      .from("guests")
      .update({ preferences_summary: summary, preferences: prefs as unknown as Json })
      .eq("id", guestId),
    "save preferences",
  );
}

export async function setVotes(guestId: string, votes: Record<string, Choice>) {
  const entries = Object.entries(votes);
  if (!entries.length) return;
  ok(
    await db()
      .from("votes")
      .upsert(
        entries.map(([option_id, choice]) => ({ option_id, guest_id: guestId, choice })),
        { onConflict: "option_id,guest_id" },
      ),
    "save votes",
  );
}

/** Undo a confirmation when adding the slots failed, so the guest can try again. */
export async function releaseConfirmation(id: string): Promise<void> {
  ok(await db().from("statements").update({ confirmed: false, confirmed_ranges: null }).eq("id", id), "release statement");
}
