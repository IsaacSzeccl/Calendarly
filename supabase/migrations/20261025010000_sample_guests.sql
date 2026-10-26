-- Demo guests seeded with made-up answers are labeled as samples wherever they appear.
alter table public.guests add column is_sample boolean not null default false;
