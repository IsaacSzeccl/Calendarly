import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;

export function dbConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Server-only database client. The service-role key never reaches a browser. */
export function db(): SupabaseClient<Database> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase is not configured (see npm run check:env)");
    client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

type Result = { data: unknown; error: { message: string } | null };

/** Throw on a Supabase error so callers never mistake a failed query for empty data. */
export function must<R extends Result>(result: R, what: string): NonNullable<R["data"]> {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null || result.data === undefined) throw new Error(`${what}: no data`);
  return result.data as NonNullable<R["data"]>;
}

/** Like `must`, for lookups where "not found" is a normal answer. */
export function maybe<R extends Result>(result: R, what: string): NonNullable<R["data"]> | null {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data ?? null) as NonNullable<R["data"]> | null;
}

/** For writes that return no rows: only an error matters. */
export function ok(result: { error: { message: string } | null }, what: string): void {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}
