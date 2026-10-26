// Generated from the Supabase schema (supabase/migrations). Regenerate after schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      ai_runs: Table<
        {
          created_at: string;
          error: string | null;
          id: string;
          input: Json | null;
          job: string;
          ms: number;
          output: string | null;
          valid: boolean;
        },
        "job" | "ms" | "valid"
      >;
      calendar_connections: Table<
        {
          created_at: string;
          encrypted_token: string;
          id: string;
          owner_id: string;
          owner_kind: string;
          provider: string;
          scope: string;
          status: string;
          updated_at: string;
        },
        "encrypted_token" | "owner_id" | "owner_kind" | "scope"
      >;
      email_log: Table<
        {
          created_at: string;
          error: string | null;
          id: string;
          kind: string;
          poll_id: string | null;
          result: string;
          to_address: string;
        },
        "kind" | "result" | "to_address"
      >;
      guests: Table<
        {
          calendar_connection_id: string | null;
          claim_token: string | null;
          created_at: string;
          email: string;
          guest_token: string;
          id: string;
          name: string;
          poll_id: string;
          preferences: Json;
          preferences_summary: string | null;
          remember: boolean;
          submitted_at: string | null;
          is_sample: boolean;
          timezone: string;
          updated_at: string;
        },
        "email" | "guest_token" | "name" | "poll_id" | "timezone"
      >;
      options: Table<
        {
          added_by_statement_id: string | null;
          created_at: string;
          ends_at: string;
          id: string;
          poll_id: string;
          source: string;
          starts_at: string;
        },
        "ends_at" | "poll_id" | "source" | "starts_at"
      >;
      polls: Table<
        {
          close_at: string | null;
          created_at: string;
          expected_count: number;
          final_option_id: string | null;
          google_event_id: string | null;
          id: string;
          organizer_calendar: Json;
          organizer_email: string | null;
          organizer_id: string;
          organizer_name: string;
          rules: Json;
          share_token: string;
          status: string;
          title: string;
          update_sent_at: string | null;
        },
        "expected_count" | "organizer_calendar" | "organizer_id" | "organizer_name" | "rules" | "share_token" | "title"
      >;
      statements: Table<
        {
          confirmed: boolean;
          confirmed_ranges: Json | null;
          created_at: string;
          guest_id: string | null;
          id: string;
          interpretation: Json | null;
          poll_id: string;
          text: string;
        },
        "poll_id" | "text"
      >;
      votes: Table<
        {
          choice: string;
          guest_id: string;
          id: string;
          option_id: string;
          updated_at: string;
        },
        "choice" | "guest_id" | "option_id"
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
