import { z } from "zod";
import { finalizePoll } from "@/lib/polls/actions";
import { ownedPoll } from "@/lib/polls/owner";

const body = z.object({ optionId: z.uuid() });

export async function POST(request: Request, { params }: RouteContext<"/api/polls/[id]/finalize">) {
  const poll = await ownedPoll((await params).id);
  if (!poll) return Response.json({ error: "Only the organizer can pick a time." }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick one of the times." }, { status: 400 });
  const result = await finalizePoll(poll, parsed.data.optionId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json(result);
}
