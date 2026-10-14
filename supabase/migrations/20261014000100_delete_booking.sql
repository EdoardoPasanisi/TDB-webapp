-- Eliminazione definitiva di una prenotazione (pensione o servizio), usata da
-- "Elimina prenotazione" nel gestionale (es. cliente non presentato, errori di
-- inserimento). Elimina la prenotazione e TUTTI i suoi movimenti del saldo (niente
-- righe "(eliminata)"); se era a pacchetto, il credito torna al cliente.
-- Se la prenotazione era già pagata, il pagamento resta: diventa credito del cliente.
--
-- Solo il server la chiama: i controlli su chi può eliminare cosa (staff con permessi
-- di gestione, o il cliente stesso solo su prenotazioni non ancora erogate) sono nel codice.

begin;

create or replace function public.delete_booking(
  p_kind text,
  p_booking_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_status text;
  v_pass_id uuid;
  v_credits int;
begin
  if p_kind = 'PENSIONE' then
    select user_id into v_user_id
    from public.bookings where id = p_booking_id
    for update;
    if not found then
      raise exception 'Prenotazione non trovata';
    end if;

    delete from public.booking_dogs where booking_id = p_booking_id;
    -- Il trigger wallet_track_booking aggiunge lo storno: subito dopo si tolgono
    -- tutte le righe della prenotazione, così il registro resta pulito.
    delete from public.bookings where id = p_booking_id;
    delete from public.wallet_entries where source_type = 'BOOKING' and source_id = p_booking_id;

  elsif p_kind = 'SERVICE_SLOT' then
    select user_id, status, pass_id, credits_spent into v_user_id, v_status, v_pass_id, v_credits
    from public.service_slot_bookings where id = p_booking_id
    for update;
    if not found then
      raise exception 'Prenotazione non trovata';
    end if;

    -- Credito restituito al pacchetto (se la prenotazione lo stava ancora usando).
    if v_status <> 'CANCELLED' and v_pass_id is not null and coalesce(v_credits, 0) > 0 then
      update public.service_passes
      set credits_used = greatest(0, credits_used - v_credits),
          status = case
            when status = 'CONSUMED' and greatest(0, credits_used - v_credits) < credits_total then 'ACTIVE'
            else status
          end
      where id = v_pass_id;
    end if;

    delete from public.service_slot_bookings where id = p_booking_id;
    delete from public.wallet_entries where source_type = 'SLOT_TAXI' and source_id = p_booking_id;

  else
    raise exception 'Tipo prenotazione non valido';
  end if;

  return v_user_id;
end;
$function$;

revoke all on function public.delete_booking(text, uuid) from public, anon, authenticated;
grant execute on function public.delete_booking(text, uuid) to service_role;

commit;
