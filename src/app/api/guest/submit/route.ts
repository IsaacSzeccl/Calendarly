import { after } from "next/server";
import { z } from "zod";
import { isValidZone } from "@/lib/engine/time";
import { getOptions, getPollByToken, saveResponse, statusOf } from "@/lib/db/polls";
import { readGuestToken, writeGuestToken } from "@/lib/guest/cookie";
import { afterGuestResponse } from "@/lib/polls/actions";

const body = z.object({
  token: z.string().min(10).max(64),
  name: z.string().trim().min(1, "Add your name.").max(80),
  email: z.email("Add a valid email address.").max(200),
  timezone: z.string().refine(isValidZone),
  votes: z.record(z.uuid(), z.enum(["yes", "prefer_not", "no"])),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.path[0] === "name" || first?.path[0] === "email" ? first.message : "Please check your answers.";
    return Response.json({ error: msg }, { status: 400 });
  }
  const input = parsed.data;

  const poll = await getPollByToken(input.token);
  if (!poll) return Response.json({ error: "This poll doesn't exist." }, { status: 404 });
  if (statusOf(poll) !== "open") {
    return Response.json({ error: "This poll has closed, so answers can't be changed." }, { status: 409 });
  }

  const optionIds = new Set((await getOptions(poll.id)).map((o) => o.id));
  if (Object.keys(input.votes).some((id) => !optionIds.has(id))) {
    return Response.json({ error: "One of the times no longer exists. Reload and try again." }, { status: 409 });
  }

  const guest = await saveResponse({
    pollId: poll.id,
    guestToken: await readGuestToken(poll.id),
    name: input.name,
    email: input.email,
    timezone: input.timezone,
    votes: input.votes,
  });
  await writeGuestToken(poll.id, guest.guestToken);
  const origin = new URL(request.url).origin;
  after(() => afterGuestResponse(poll.id, origin));

  return Response.json({ ok: true, name: guest.name });
}
