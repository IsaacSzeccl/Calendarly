import "server-only";
import { getOrganizer } from "@/lib/auth/organizer";
import { getPoll, type Poll } from "@/lib/db/polls";

/** The poll, only if the signed-in organizer owns it. Guests and strangers get null. */
export async function ownedPoll(id: string): Promise<Poll | null> {
  const [organizer, poll] = await Promise.all([getOrganizer(), getPoll(id)]);
  if (!organizer || !poll || poll.organizerId !== organizer.id) return null;
  return poll;
}
