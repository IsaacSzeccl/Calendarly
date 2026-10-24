-- Calendarly: all tables. Times are UTC (timestamptz) and shown in each viewer's timezone.
-- Only the server reads and writes these tables (service role). Row-level security is on
-- with no policies, so the browser's anon key can read nothing.

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  organizer_id text not null,
  organizer_email text,
  organizer_name text not null,
  title text not null,
  rules jsonb not null,               -- people, window, duration, hours, constraints, onlyIfNecessary
  expected_count int not null check (expected_count between 1 and 50),
  organizer_calendar jsonb not null,  -- which calendar the organizer's free time comes from
  close_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed', 'finalized')),
  share_token text not null unique,
  final_option_id uuid,
  google_event_id text,
  update_sent_at timestamptz,         -- the "X of Y have filled in" email goes out once
  created_at timestamptz not null default now()
);
create index polls_organizer_idx on public.polls (organizer_id, created_at desc);

create table public.statements (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  guest_id uuid,
  text text not null,
  interpretation jsonb,
  confirmed boolean not null default false,
  confirmed_ranges jsonb,
  created_at timestamptz not null default now()
);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  source text not null check (source in ('organizer_free', 'guest_added', 'ai_added')),
  added_by_statement_id uuid references public.statements (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (poll_id, starts_at)
);

alter table public.polls
  add constraint polls_final_option_fk
  foreign key (final_option_id) references public.options (id) on delete set null;

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('organizer', 'guest')),
  owner_id text not null,
  provider text not null default 'google',
  encrypted_token text not null,
  scope text not null,
  status text not null default 'active' check (status in ('active', 'needs_reconnect', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_connections_owner_idx on public.calendar_connections (owner_kind, owner_id);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  name text not null,
  email text not null,
  timezone text not null,
  guest_token text not null unique,
  preferences_summary text,
  preferences jsonb not null default '[]'::jsonb,
  calendar_connection_id uuid references public.calendar_connections (id) on delete set null,
  remember boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index guests_poll_email_idx on public.guests (poll_id, lower(email));

alter table public.statements
  add constraint statements_guest_fk
  foreign key (guest_id) references public.guests (id) on delete cascade;

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.options (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete cascade,
  choice text not null check (choice in ('yes', 'prefer_not', 'no')),
  updated_at timestamptz not null default now(),
  unique (option_id, guest_id)
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  input jsonb,
  output text,
  valid boolean not null,
  ms int not null,
  error text,
  created_at timestamptz not null default now()
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('confirmation', 'new_options', 'poll_update')),
  to_address text not null,
  poll_id uuid references public.polls (id) on delete cascade,
  result text not null check (result in ('sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now()
);

alter table public.polls enable row level security;
alter table public.options enable row level security;
alter table public.guests enable row level security;
alter table public.votes enable row level security;
alter table public.statements enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.ai_runs enable row level security;
alter table public.email_log enable row level security;
