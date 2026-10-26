import { getOrganizer } from "@/lib/auth/organizer";
import { DisconnectCalendar } from "./DisconnectCalendar";

/** Who is signed in, with a way out. Guests (no session) see nothing. */
export async function AccountMenu() {
  const organizer = await getOrganizer();
  if (!organizer) return null;
  return (
    <form action="/auth/sign-out" method="post" className="flex items-center gap-3 text-sm text-pencil">
      <span className="hidden sm:inline">{organizer.email ?? organizer.name}</span>
      {organizer.calendar?.kind === "google" && <DisconnectCalendar />}
      <button type="submit" className="underline underline-offset-4 hover:text-ink">
        Sign out
      </button>
    </form>
  );
}
