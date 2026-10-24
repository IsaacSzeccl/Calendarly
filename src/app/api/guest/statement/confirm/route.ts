import { after } from "next/server";
import { z } from "zod";
import { rangesToIntervals, toPreferences } from "@/lib/ai/parseStatement";
import { providerFor } from "@/lib/calendar";
import { addOptions, getGuestByToken, getOptions, getPollByToken, statusOf } from "@/lib/db/polls";
import { claimConfirmation, getStatement, setGuestPreferences, setVotes } from "@/lib/db/statements";
import { addAiSlots } from "@/lib/engine/slots";
import { intersect, isValidZone } from "@/lib/engine/time";
import { readGuestToken } from "@/lib/guest/cookie";
import { notifyNewOptions } from "@/lib/polls/actions";
import { windowRange } from "@/lib/polls/preview";

const body = z.object({
  token: z.string().min(10).max(64),
  statementId: z.uuid(),
  /** The guest may correct the timezone in the "What I understood" panel. */
  timezone: z.string().refine(isValidZone).optional(),
});

/**
 * Step 2: the guest said "Looks right". Code, not the model, decides what is
 * added: only where the organizer is free, no duplicates, at most 3 per poll.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Something was missing. Try again." }, { status: 400 });
  const { token, statementId, timezone } = parsed.data;

  const poll = await getPollByToken(token);
  if (!poll) return Response.json({ error: "This poll doesn't exist." }, { status: 404 });
  if (statusOf(poll) !== "open") return Response.json({ error: "This poll has closed." }, { status: 409 });
  const guestToken = await readGuestToken(poll.id);
  const guest = guestToken ? await getGuestByToken(poll.id, guestToken) : null;
  const statement = await getStatement(statementId);
  if (!guest || !statement || statement.guestId !== guest.id || !statement.interpretation) {
    return Response.json({ error: "That suggestion isn't yours to confirm." }, { status: 403 });
  }

  const interpretation = { ...statement.interpretation, timezone: timezone ?? statement.interpretation.timezone };
  const ranges = intersect(rangesToIntervals(interpretation), [windowRange(poll.rules)]);
  if (!(await claimConfirmation(statement.id, ranges))) {
    return Response.json({ error: "This suggestion was already confirmed." }, { status: 409 });
  }

  const window = windowRange(poll.rules);
  const calendar = poll.organizerCalendar;
  const [organizerBusy, existing] = await Promise.all([
    providerFor(calendar).getBusy(calendar, window.start, window.end),
    getOptions(poll.id),
  ]);
  const result = addAiSlots({
    ranges,
    rules: poll.rules,
    organizerBusy,
    existing,
    aiAddedSoFar: existing.filter((o) => o.source === "ai_added").length,
    now: Date.now(),
  });

  const added = result.added.length ? await addOptions(poll.id, result.added, "ai_added", statement.id) : [];
  // The guest suggested these times, so they start as a "yes" they can change.
  await setVotes(guest.id, Object.fromEntries(added.map((o) => [o.id, "yes" as const])));
  await setGuestPreferences(
    guest.id,
    interpretation.preferencesSummary ?? null,
    toPreferences(interpretation, guest.name),
  );

  if (added.length) {
    const origin = new URL(request.url).origin;
    after(() => notifyNewOptions(poll, added, guest.id, origin));
  }

  const why = new Set(result.skipped.map((s) => s.why));
  const outcome = added.length ? "added" : why.has("cap") ? "cap" : why.has("duplicate") && !why.has("busy") ? "duplicate" : "busy";
  return Response.json({
    outcome,
    added: added.map(({ id, start, end }) => ({ id, start, end })),
  });
}
