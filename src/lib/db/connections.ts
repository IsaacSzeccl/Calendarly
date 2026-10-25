import "server-only";
import { decryptToken, encryptToken } from "@/lib/calendar/crypto";
import { db, maybe, must, ok } from "./client";

export type OwnerKind = "organizer" | "guest";

/**
 * Save the person's Google token. Reconnecting updates the same row, so polls
 * that point at this connection keep working after a token expires.
 */
export async function saveConnection(i: {
  ownerKind: OwnerKind;
  ownerId: string;
  refreshToken: string;
  scope: string;
}): Promise<string> {
  const fields = {
    encrypted_token: encryptToken(i.refreshToken),
    scope: i.scope,
    status: "active",
    updated_at: new Date().toISOString(),
  };
  const existing = await findConnection(i.ownerKind, i.ownerId);
  if (existing) {
    ok(await db().from("calendar_connections").update(fields).eq("id", existing.id), "update connection");
    return existing.id;
  }
  const row = must(
    await db()
      .from("calendar_connections")
      .insert({ ...fields, owner_kind: i.ownerKind, owner_id: i.ownerId })
      .select("id")
      .single(),
    "save connection",
  );
  return row.id;
}

export async function findConnection(ownerKind: OwnerKind, ownerId: string) {
  return maybe(
    await db()
      .from("calendar_connections")
      .select("id, status")
      .eq("owner_kind", ownerKind)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "find connection",
  );
}

export async function connectionStatus(id: string): Promise<string | null> {
  const row = maybe(
    await db().from("calendar_connections").select("status").eq("id", id).maybeSingle(),
    "connection status",
  );
  return row?.status ?? null;
}

/** Remove the connection and return its token so it can be revoked with Google. */
export async function deleteConnection(id: string): Promise<string | null> {
  const row = maybe(
    await db().from("calendar_connections").delete().eq("id", id).select("encrypted_token").maybeSingle(),
    "delete connection",
  );
  return row ? decryptToken(row.encrypted_token) : null;
}

/** What the Google provider needs: the decrypted token and a way to flag expiry. */
export const connectionStore = {
  async refreshToken(id: string): Promise<string | null> {
    const row = maybe(
      await db().from("calendar_connections").select("encrypted_token, status").eq("id", id).maybeSingle(),
      "load connection",
    );
    if (!row || row.status !== "active") return null;
    return decryptToken(row.encrypted_token);
  },
  async markNeedsReconnect(id: string): Promise<void> {
    ok(
      await db()
        .from("calendar_connections")
        .update({ status: "needs_reconnect", updated_at: new Date().toISOString() })
        .eq("id", id),
      "flag connection",
    );
  },
};
