import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "calendarly_oauth";

export type OAuthIntent = { state: string; owner: "organizer" | "guest"; ownerId: string; returnTo: string; pollId?: string };

/** Remember who asked to connect, so the callback can't be replayed by someone else. */
export async function startIntent(i: Omit<OAuthIntent, "state">): Promise<string> {
  const state = randomBytes(18).toString("base64url");
  (await cookies()).set(COOKIE, JSON.stringify({ ...i, state }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return state;
}

export async function takeIntent(state: string | null): Promise<OAuthIntent | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete(COOKIE);
  if (!raw || !state) return null;
  try {
    const intent = JSON.parse(raw) as OAuthIntent;
    return intent.state === state ? intent : null;
  } catch {
    return null;
  }
}
