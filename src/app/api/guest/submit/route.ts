import { after } from "next/server";
import { z } from "zod";
import { isValidZone } from "@/lib/engine/time";
import {
  EmailTakenError,
  getGuestByEmail,
  getOptions,
  getPollByToken,
  issueClaimToken,
  saveResponse,
  statusOf,
} from "@/lib/db/polls";
import { sendEmail } from "@/lib/email/send";
import { privateLinkEmail } from "@/lib/email/templates";
import { readGuestToken, writeGuestToken } from "@/lib/guest/cookie";
import { afterGuestResponse } from "@/lib/polls/actions";
import { privateLink } from "@/lib/polls/meetAgain";
import { allow } from "@/lib/rateLimit";

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

  let guest;
  try {
    guest = await saveResponse({
      pollId: poll.id,
      guestToken: await readGuestToken(poll.id),
      name: input.name,
      email: input.email,
      timezone: input.timezone,
      votes: input.votes,
    });
  } catch (e) {
    if (!(e instanceof EmailTakenError)) throw e;
    // Only the owner of that address can take those answers over: they get a private link by email.
    const existing = await getGuestByEmail(poll.id, input.email);
    if (existing && allow(`private-link:${existing.id}`, 3, 60 * 60_000)) {
      const claim = await issueClaimToken(existing.id);
      const origin = new URL(request.url).origin;
      after(() =>
        sendEmail({
          kind: "private_link",
          to: existing.email,
          pollId: poll.id,
          ...privateLinkEmail({
            guestName: existing.name,
            title: poll.title,
            link: privateLink(origin, poll.shareToken, claim),
          }),
        }),
      );
    }
    return Response.json(
      {
        error:
          "That email already has answers on this poll. We've emailed a private link to that address: open it to see or change those answers here.",
      },
      { status: 409 },
    );
  }
  await writeGuestToken(poll.id, guest.guestToken);
  const origin = new URL(request.url).origin;
  after(() => afterGuestResponse(poll.id, origin));

  return Response.json({ ok: true, name: guest.name });
}
