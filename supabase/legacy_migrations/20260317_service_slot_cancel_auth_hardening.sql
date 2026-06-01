-- 20260317_service_slot_cancel_auth_hardening.sql
-- Hardening RPC cancel_service_slot_booking: il caller autenticato deve coincidere con p_user_id.

create or replace function public.cancel_service_slot_booking(p_user_id uuid, p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_auth_user_id uuid;
  v_start_at timestamptz;
  v_pass_id uuid;
  v_credits_spent int;
  v_refund_allowed boolean;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null or v_auth_user_id <> p_user_id then
    raise exception 'Non autorizzato';
  end if;

  select
    s.start_at,
    b.pass_id,
    b.credits_spent
  into
    v_start_at,
    v_pass_id,
    v_credits_spent
  from public.service_slot_bookings b
  join public.service_slots s on s.id = b.slot_id
  where b.id = p_booking_id
    and b.user_id = p_user_id
    and b.status in ('CONFIRMED', 'PAID');

  if not found then
    raise exception 'Prenotazione non trovata o non cancellabile';
  end if;

  v_refund_allowed := now() <= (v_start_at - interval '24 hours');

  update public.service_slot_bookings
  set status = 'CANCELLED'
  where id = p_booking_id
    and user_id = p_user_id
    and status in ('CONFIRMED', 'PAID');

  if v_refund_allowed is true
     and v_pass_id is not null
     and v_credits_spent is not null
     and v_credits_spent > 0 then
    update public.service_passes
    set credits_used = greatest(credits_used - v_credits_spent, 0)
    where id = v_pass_id
      and user_id = p_user_id;
  end if;
end;
$function$;

revoke all on function public.cancel_service_slot_booking(uuid, uuid) from public;
revoke all on function public.cancel_service_slot_booking(uuid, uuid) from anon;
revoke all on function public.cancel_service_slot_booking(uuid, uuid) from authenticated;
grant execute on function public.cancel_service_slot_booking(uuid, uuid) to authenticated;
