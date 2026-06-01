-- 20260317_wallet_and_pass_hardening.sql
-- Hardening produzione:
-- - wallet modificabile solo tramite RPC sicura
-- - acquisto pass atomico tramite RPC
-- - rimozione insert diretti legacy su service_passes / service_slot_bookings
-- - grant insert/update column-level su profiles per bloccare campi sensibili come wallet_due_eur

create or replace function public.add_wallet_due(p_amount_eur numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Non autorizzato';
  end if;

  if p_amount_eur is null or p_amount_eur = 0 then
    return;
  end if;

  update public.profiles
  set wallet_due_eur = greatest(0, coalesce(wallet_due_eur, 0) + p_amount_eur)
  where user_id = v_user_id;

  if not found then
    raise exception 'Profilo utente non trovato';
  end if;
end;
$function$;

revoke all on function public.add_wallet_due(numeric) from public;
revoke all on function public.add_wallet_due(numeric) from anon;
revoke all on function public.add_wallet_due(numeric) from authenticated;
grant execute on function public.add_wallet_due(numeric) to authenticated;

create or replace function public.purchase_service_pass(p_product_id uuid)
returns public.service_passes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_product public.service_products%rowtype;
  v_pass public.service_passes%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Non autorizzato';
  end if;

  if p_product_id is null then
    raise exception 'Prodotto mancante';
  end if;

  select *
  into v_product
  from public.service_products
  where id = p_product_id
    and is_active = true;

  if not found then
    raise exception 'Prodotto non trovato o non attivo';
  end if;

  insert into public.service_passes (
    user_id,
    service_type,
    service_variant,
    product_id,
    credits_total,
    credits_used,
    status
  )
  values (
    v_user_id,
    v_product.service_type,
    v_product.service_variant,
    v_product.id,
    v_product.credits,
    0,
    'ACTIVE'
  )
  returning *
  into v_pass;

  update public.profiles
  set wallet_due_eur = greatest(0, coalesce(wallet_due_eur, 0) + coalesce(v_product.price_eur, 0))
  where user_id = v_user_id;

  if not found then
    raise exception 'Profilo utente non trovato';
  end if;

  return v_pass;
end;
$function$;

revoke all on function public.purchase_service_pass(uuid) from public;
revoke all on function public.purchase_service_pass(uuid) from anon;
revoke all on function public.purchase_service_pass(uuid) from authenticated;
grant execute on function public.purchase_service_pass(uuid) to authenticated;

drop policy if exists "service_passes_insert_own" on public.service_passes;
drop policy if exists "service_slot_bookings_insert_own" on public.service_slot_bookings;

revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;

grant insert (
  user_id,
  first_name,
  last_name,
  phone,
  email,
  address_line,
  city,
  zip_code,
  province,
  fiscal_code,
  birth_date,
  dog_address_line,
  dog_city,
  dog_zip_code,
  dog_province,
  id_document_path,
  id_document_uploaded_at,
  show_first_name_on_dog_card,
  show_last_name_on_dog_card,
  show_phone_on_dog_card,
  show_email_on_dog_card,
  show_address_on_dog_card,
  show_dog_address_on_dog_card
) on public.profiles to authenticated;

grant update (
  first_name,
  last_name,
  phone,
  email,
  address_line,
  city,
  zip_code,
  province,
  fiscal_code,
  birth_date,
  dog_address_line,
  dog_city,
  dog_zip_code,
  dog_province,
  id_document_path,
  id_document_uploaded_at,
  show_first_name_on_dog_card,
  show_last_name_on_dog_card,
  show_phone_on_dog_card,
  show_email_on_dog_card,
  show_address_on_dog_card,
  show_dog_address_on_dog_card
) on public.profiles to authenticated;
