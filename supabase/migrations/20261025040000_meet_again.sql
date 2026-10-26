-- Meet again: guests copied into an organizer's next poll get a "meet_again"
-- email with a private link to see or change what their calendar answered.
alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log
  add constraint email_log_kind_check
  check (kind in ('confirmation', 'new_options', 'poll_update', 'meet_again'));

-- A single-use code for the private link: the long-lived guest token never
-- goes in a URL, and a used or forwarded link can't be replayed.
alter table public.guests add column claim_token text unique;

-- The private link is also emailed when someone answers again with an address
-- already used on the poll (a second device, or a guest brought along).
alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log
  add constraint email_log_kind_check
  check (kind in ('confirmation', 'new_options', 'poll_update', 'meet_again', 'private_link'));
