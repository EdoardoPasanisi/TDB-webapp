-- 20260129_cancel_refund_logic.sql
-- Modifica: cancel_service_slot_booking
-- - Cancella sempre (status -> CANCELLED) se booking è CONFIRMED o PAID e appartiene all'utente
-- - Rimborsa crediti sul pass SOLO se la cancellazione avviene con più di 24h di anticipo

create or replace function public.cancel_service_slot_booking(p_user_id uuid, p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_start_at timestamptz;
  v_pass_id uuid;
  v_credits_spent int;
  v_refund_allowed boolean;
begin
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

  -- refund solo se mancano più di 24h all'appuntamento
  v_refund_allowed := now() <= (v_start_at - interval '24 hours');

  -- 1) Cancella sempre
  update public.service_slot_bookings
  set status = 'CANCELLED'
  where id = p_booking_id
    and user_id = p_user_id
    and status in ('CONFIRMED', 'PAID');

  -- 2) Refund crediti solo se consentito e se pass_id esiste
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
