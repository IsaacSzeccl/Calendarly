-- A guest counts as "answered" only once they press Save / Send. Connecting a
-- calendar, adding a time or checking a statement creates the guest (so their
-- calendar has an owner) but leaves submitted_at empty. Everyone who already
-- exists has answered; rows created by other paths (demo seed, meet again)
-- default to answered.
alter table public.guests add column submitted_at timestamptz default now();
update public.guests set submitted_at = created_at;
