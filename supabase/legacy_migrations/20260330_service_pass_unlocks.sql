-- 20260330_service_pass_unlocks.sql
-- Pacchetti multi-credito per asilo/addestramento/consulenza acquistabili ma non utilizzabili
-- finché il gestionale non conferma il pagamento.

alter table public.service_passes
  add column if not exists unlocked_at timestamptz null,
  add column if not exists unlocked_by uuid null references auth.users(id) on delete set null;

update public.service_passes
set unlocked_at = coalesce(unlocked_at, purchased_at)
where status = 'ACTIVE'
  and unlocked_at is null;

alter table public.service_passes
  drop constraint if exists service_passes_status_check;

alter table public.service_passes
  add constraint service_passes_status_check
  check (status in ('ACTIVE', 'LOCKED', 'CONSUMED', 'EXPIRED', 'CANCELLED'));

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
  v_initial_status text;
  v_unlocked_at timestamptz;
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

  v_initial_status := case
    when v_product.service_type in ('ASILO', 'ADDESTRAMENTO', 'CONSULENZA')
      and coalesce(v_product.credits, 0) > 1
      then 'LOCKED'
    else 'ACTIVE'
  end;

  v_unlocked_at := case
    when v_initial_status = 'ACTIVE' then now()
    else null
  end;

  insert into public.service_passes (
    user_id,
    service_type,
    service_variant,
    product_id,
    credits_total,
    credits_used,
    status,
    unlocked_at
  )
  values (
    v_user_id,
    v_product.service_type,
    v_product.service_variant,
    v_product.id,
    v_product.credits,
    0,
    v_initial_status,
    v_unlocked_at
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
