-- The database enforces "at most 3 AI-added slots per poll" too, so two guests
-- confirming at the same moment can't push a poll past the cap. Keep the number
-- in step with aiSlotCap in src/lib/config.ts.
create or replace function public.enforce_ai_slot_cap()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.source = 'ai_added' then
    -- Serialize concurrent inserts for the same poll.
    perform 1 from public.polls where id = new.poll_id for update;
    if (select count(*) from public.options where poll_id = new.poll_id and source = 'ai_added') >= 3 then
      raise exception 'ai slot cap reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_ai_slot_cap() from public, anon, authenticated;

create trigger options_ai_slot_cap
  before insert on public.options
  for each row execute function public.enforce_ai_slot_cap();
