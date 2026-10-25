-- Guests can now add times two ways: a typed statement (ai_added) or their
-- connected calendar (guest_added). Both share one cap of 3 per poll, so the
-- list never grows past what people can read. Keep the number in step with
-- guestSlotCap in src/lib/config.ts.
create or replace function public.enforce_ai_slot_cap()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.source in ('ai_added', 'guest_added') then
    -- Serialize concurrent inserts for the same poll.
    perform 1 from public.polls where id = new.poll_id for update;
    if (select count(*) from public.options
        where poll_id = new.poll_id and source in ('ai_added', 'guest_added')) >= 3 then
      raise exception 'guest slot cap reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_ai_slot_cap() from public, anon, authenticated;
