import "server-only";
import { cookies } from "next/headers";

/** Each poll gets its own private guest cookie, so one browser can answer several polls. */
export const guestCookieName = (pollId: string) => `calendarly_guest_${pollId}`;

export async function readGuestToken(pollId: string): Promise<string | null> {
  return (await cookies()).get(guestCookieName(pollId))?.value ?? null;
}

export async function writeGuestToken(pollId: string, token: string): Promise<void> {
  (await cookies()).set(guestCookieName(pollId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}
