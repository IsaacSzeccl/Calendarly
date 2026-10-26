import { closePoll } from "@/lib/polls/actions";
import { ownedPoll } from "@/lib/polls/owner";

export async function POST(request: Request, { params }: RouteContext<"/api/polls/[id]/close">) {
  const poll = await ownedPoll((await params).id);
  if (!poll) return Response.json({ error: "Only the organizer can close this poll." }, { status: 403 });
  await closePoll(poll, new URL(request.url).origin);
  return Response.json({ ok: true });
}
