-- =============================================================
-- Baseline migration — auto-generated from remote schema
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tables
CREATE TABLE IF NOT EXISTS booking_dogs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  dog_id uuid NOT NULL,
  accommodation_type text NOT NULL,
  accommodation_price_per_day numeric(10,2) NOT NULL,
  days_count integer NOT NULL,
  accommodation_subtotal numeric(10,2) NOT NULL,
  extras jsonb,
  extras_subtotal numeric(10,2) NOT NULL DEFAULT 0,
  per_dog_total numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dog_id uuid NOT NULL,
  service_type text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  notes text,
  status text NOT NULL DEFAULT 'DRAFT'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  total_amount_cents integer DEFAULT 2000,
  stripe_session_id text,
  accommodation_type text,
  extras text[] DEFAULT '{}'::text[],
  arrival_time text,
  departure_time text,
  total_price numeric,
  dogs_count integer,
  taxi_option text,
  taxi_price numeric(10,2),
  alloggio_total_full numeric(10,2),
  alloggio_discount_percent numeric(5,2),
  alloggio_total_discounted numeric(10,2),
  extras_total numeric(10,2),
  taxi_distance_band text DEFAULT 'ENTRO_40'::text,
  taxi_pickup_time time,
  taxi_return_time time,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'BOT_ACTIVE'::text,
  title text,
  handoff_reason text,
  handoff_summary text,
  assigned_admin_user_id uuid,
  handoff_requested_at timestamptz,
  admin_claimed_at timestamptz,
  closed_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_type text NOT NULL,
  admin_user_id uuid,
  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS customer_media (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  dog_id uuid,
  media_type text NOT NULL,
  storage_path text NOT NULL,
  caption text,
  visible_until timestamptz NOT NULL,
  created_by_staff_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS dogs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  breed text,
  microchip text,
  birth_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  public_id text,
  is_public boolean DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  show_breed boolean DEFAULT true,
  show_microchip boolean DEFAULT false,
  show_birth_date boolean DEFAULT false,
  show_notes boolean DEFAULT false,
  size_category text,
  grooming_difficulty text,
  show_size boolean NOT NULL DEFAULT false,
  coat_color text,
  temperament text[],
  show_coat_color boolean NOT NULL DEFAULT false,
  show_temperament boolean NOT NULL DEFAULT false,
  sex text,
  show_sex boolean NOT NULL DEFAULT true,
  photo_path text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid NOT NULL,
  booking_in_app boolean NOT NULL DEFAULT true,
  booking_email boolean NOT NULL DEFAULT false,
  document_in_app boolean NOT NULL DEFAULT true,
  document_email boolean NOT NULL DEFAULT false,
  chat_in_app boolean NOT NULL DEFAULT true,
  chat_email boolean NOT NULL DEFAULT false,
  media_in_app boolean NOT NULL DEFAULT true,
  media_email boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  first_name text,
  last_name text,
  phone text,
  address_line text,
  city text,
  zip_code text,
  province text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  email text,
  show_owner_name_on_dog_card boolean NOT NULL DEFAULT true,
  show_phone_on_dog_card boolean NOT NULL DEFAULT true,
  show_email_on_dog_card boolean NOT NULL DEFAULT false,
  show_address_on_dog_card boolean NOT NULL DEFAULT false,
  fiscal_code text,
  birth_date date,
  dog_address_line text,
  dog_city text,
  dog_zip_code text,
  dog_province text,
  id_document_path text,
  id_document_uploaded_at timestamptz,
  show_fiscal_code_on_dog_card boolean NOT NULL DEFAULT false,
  show_birth_date_on_dog_card boolean NOT NULL DEFAULT false,
  show_dog_address_on_dog_card boolean NOT NULL DEFAULT false,
  show_first_name_on_dog_card boolean NOT NULL DEFAULT true,
  show_last_name_on_dog_card boolean NOT NULL DEFAULT true,
  wallet_due_eur numeric NOT NULL DEFAULT 0,
  photo_path text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS service_passes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_type text NOT NULL,
  service_variant text,
  product_id uuid,
  credits_total integer NOT NULL,
  credits_used integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE'::text,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  unlocked_at timestamptz,
  unlocked_by uuid,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS service_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_type text NOT NULL,
  service_variant text,
  name text NOT NULL,
  credits integer NOT NULL,
  price_eur numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS service_slot_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_type text NOT NULL,
  slot_id uuid NOT NULL,
  dog_id uuid,
  status text NOT NULL DEFAULT 'CONFIRMED'::text,
  notes text,
  pricing_option text,
  total_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  service_variant text,
  dog_ids uuid[],
  taxi_enabled boolean NOT NULL DEFAULT false,
  taxi_distance_km numeric,
  taxi_price_eur numeric,
  pass_id uuid,
  credits_spent integer NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS service_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_type text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  service_variant text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS service_slots_with_remaining (
  id uuid,
  service_type text,
  start_at timestamptz,
  end_at timestamptz,
  capacity integer,
  is_active boolean,
  notes text,
  created_at timestamptz,
  service_variant text,
  remaining_capacity integer
);

CREATE TABLE IF NOT EXISTS staff_accounts (
  user_id uuid NOT NULL,
  role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS staff_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS user_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'PENDING'::text,
  accepted_at timestamptz,
  accepted_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  staff_note text,
  PRIMARY KEY (id)
);

-- Foreign keys
ALTER TABLE booking_dogs ADD CONSTRAINT booking_dogs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE;
ALTER TABLE booking_dogs ADD CONSTRAINT booking_dogs_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs (id) ON DELETE RESTRICT;
ALTER TABLE bookings ADD CONSTRAINT bookings_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs (id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations (id) ON DELETE CASCADE;
ALTER TABLE customer_media ADD CONSTRAINT customer_media_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE;
ALTER TABLE customer_media ADD CONSTRAINT customer_media_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs (id) ON DELETE SET NULL;
ALTER TABLE service_passes ADD CONSTRAINT service_passes_product_id_fkey FOREIGN KEY (product_id) REFERENCES service_products (id) ON DELETE SET NULL;
ALTER TABLE service_slot_bookings ADD CONSTRAINT service_slot_bookings_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs (id) ON DELETE SET NULL;
ALTER TABLE service_slot_bookings ADD CONSTRAINT service_slot_bookings_pass_id_fkey FOREIGN KEY (pass_id) REFERENCES service_passes (id) ON DELETE SET NULL;
ALTER TABLE service_slot_bookings ADD CONSTRAINT service_slot_bookings_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES service_slots (id) ON DELETE CASCADE;

-- Unique constraints
ALTER TABLE dogs ADD CONSTRAINT dogs_microchip_key UNIQUE (microchip);
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

-- Check constraints
ALTER TABLE chat_conversations ADD CONSTRAINT chat_conversations_handoff_reason_check CHECK ((handoff_reason = ANY (ARRAY['USER_REQUEST'::text, 'MODEL_UNCERTAIN'::text, 'SENSITIVE_TOPIC'::text, 'SYSTEM_ERROR'::text])));
ALTER TABLE chat_conversations ADD CONSTRAINT chat_conversations_status_check CHECK ((status = ANY (ARRAY['BOT_ACTIVE'::text, 'HANDOFF_REQUESTED'::text, 'ADMIN_ACTIVE'::text, 'CLOSED'::text])));
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['USER'::text, 'ASSISTANT'::text, 'ADMIN'::text, 'SYSTEM'::text])));
ALTER TABLE customer_media ADD CONSTRAINT customer_media_media_type_check CHECK ((media_type = ANY (ARRAY['IMAGE'::text, 'VIDEO'::text])));
ALTER TABLE dogs ADD CONSTRAINT dogs_sex_check CHECK ((sex = ANY (ARRAY['male'::text, 'female'::text])));
ALTER TABLE service_passes ADD CONSTRAINT service_passes_credits_total_check CHECK ((credits_total >= 1));
ALTER TABLE service_passes ADD CONSTRAINT service_passes_credits_used_check CHECK ((credits_used >= 0));
ALTER TABLE service_passes ADD CONSTRAINT service_passes_service_type_check CHECK ((service_type = ANY (ARRAY['PENSIONE'::text, 'ASILO'::text, 'ADDESTRAMENTO'::text, 'CONSULENZA'::text])));
ALTER TABLE service_passes ADD CONSTRAINT service_passes_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'LOCKED'::text, 'CONSUMED'::text, 'EXPIRED'::text, 'CANCELLED'::text])));
ALTER TABLE service_products ADD CONSTRAINT service_products_credits_check CHECK ((credits >= 1));
ALTER TABLE service_products ADD CONSTRAINT service_products_price_eur_check CHECK ((price_eur >= (0)::numeric));
ALTER TABLE service_products ADD CONSTRAINT service_products_service_type_check CHECK ((service_type = ANY (ARRAY['PENSIONE'::text, 'ASILO'::text, 'ADDESTRAMENTO'::text, 'CONSULENZA'::text])));
ALTER TABLE service_slot_bookings ADD CONSTRAINT service_slot_bookings_service_type_check CHECK ((service_type = ANY (ARRAY['PENSIONE'::text, 'ASILO'::text, 'ADDESTRAMENTO'::text, 'CONSULENZA'::text, 'TARGHETTA'::text])));
ALTER TABLE service_slot_bookings ADD CONSTRAINT service_slot_bookings_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PENDING'::text, 'CONFIRMED'::text, 'PAID'::text, 'CANCELLED'::text, 'COMPLETED'::text])));
ALTER TABLE service_slots ADD CONSTRAINT service_slots_capacity_check CHECK ((capacity >= 1));
ALTER TABLE service_slots ADD CONSTRAINT service_slots_service_type_check CHECK ((service_type = ANY (ARRAY['PENSIONE'::text, 'ASILO'::text, 'ADDESTRAMENTO'::text, 'CONSULENZA'::text, 'TARGHETTA'::text])));
ALTER TABLE staff_accounts ADD CONSTRAINT staff_accounts_role_check CHECK ((role = ANY (ARRAY['ADMIN'::text, 'VIEWER'::text])));
ALTER TABLE staff_notifications ADD CONSTRAINT staff_notifications_type_check CHECK ((type = ANY (ARRAY['BOOKING_ACTION_REQUIRED'::text, 'DOCUMENT_ACTION_REQUIRED'::text, 'CHAT_ACTION_REQUIRED'::text])));
ALTER TABLE user_documents ADD CONSTRAINT user_documents_kind_check CHECK ((kind = ANY (ARRAY['ID_DOCUMENT'::text, 'WAIVER_SIGNED'::text])));
ALTER TABLE user_documents ADD CONSTRAINT user_documents_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'ACCEPTED'::text, 'REJECTED'::text])));

-- Indexes
CREATE INDEX idx_booking_dogs_booking_id ON public.booking_dogs USING btree (booking_id);
CREATE INDEX idx_booking_dogs_dog_id ON public.booking_dogs USING btree (dog_id);
CREATE INDEX chat_conversations_assigned_admin_idx ON public.chat_conversations USING btree (assigned_admin_user_id, status, last_message_at DESC);
CREATE INDEX chat_conversations_status_last_message_idx ON public.chat_conversations USING btree (status, last_message_at DESC);
CREATE UNIQUE INDEX chat_conversations_user_active_idx ON public.chat_conversations USING btree (user_id) WHERE (status <> 'CLOSED'::text);
CREATE INDEX chat_messages_conversation_created_idx ON public.chat_messages USING btree (conversation_id, created_at);
CREATE INDEX chat_messages_sender_created_idx ON public.chat_messages USING btree (sender_type, created_at DESC);
CREATE INDEX customer_media_booking_id_created_at_idx ON public.customer_media USING btree (booking_id, created_at DESC);
CREATE INDEX customer_media_user_id_created_at_idx ON public.customer_media USING btree (user_id, created_at DESC);
CREATE INDEX customer_media_visible_until_idx ON public.customer_media USING btree (visible_until DESC);
CREATE UNIQUE INDEX dogs_public_id_key ON public.dogs USING btree (public_id) WHERE (public_id IS NOT NULL);
CREATE INDEX notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX notifications_user_id_read_at_idx ON public.notifications USING btree (user_id, read_at, created_at DESC);
CREATE INDEX service_passes_user_idx ON public.service_passes USING btree (user_id);
CREATE INDEX service_passes_user_type_variant_idx ON public.service_passes USING btree (user_id, service_type, service_variant, status);
CREATE INDEX service_products_type_variant_idx ON public.service_products USING btree (service_type, service_variant);
CREATE INDEX service_slot_bookings_slot_idx ON public.service_slot_bookings USING btree (slot_id);
CREATE UNIQUE INDEX service_slot_bookings_unique_slot_dog_active ON public.service_slot_bookings USING btree (slot_id, dog_id) WHERE (status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'PAID'::text]));
CREATE INDEX service_slot_bookings_user_idx ON public.service_slot_bookings USING btree (user_id);
CREATE INDEX idx_service_slots_type_variant_start ON public.service_slots USING btree (service_type, service_variant, start_at) WHERE (is_active = true);
CREATE INDEX service_slots_type_start_idx ON public.service_slots USING btree (service_type, start_at);
CREATE INDEX service_slots_type_variant_start_idx ON public.service_slots USING btree (service_type, service_variant, start_at);
CREATE INDEX staff_accounts_role_idx ON public.staff_accounts USING btree (role, is_active);
CREATE INDEX staff_notifications_user_id_created_at_idx ON public.staff_notifications USING btree (user_id, created_at DESC);
CREATE INDEX staff_notifications_user_id_read_at_idx ON public.staff_notifications USING btree (user_id, read_at, created_at DESC);
CREATE INDEX user_documents_status_idx ON public.user_documents USING btree (status);
CREATE INDEX user_documents_user_id_idx ON public.user_documents USING btree (user_id);
CREATE INDEX user_documents_user_kind_idx ON public.user_documents USING btree (user_id, kind, created_at DESC);

-- Functions
CREATE OR REPLACE FUNCTION public.add_wallet_due(p_amount_eur numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.add_wallet_due(p_user_id uuid, p_amount_eur numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.profiles
  set wallet_due_eur = greatest(0, wallet_due_eur + coalesce(p_amount_eur, 0))
  where user_id = p_user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.book_service_slot(p_user_id uuid, p_slot_id uuid, p_pass_id uuid, p_service_type text, p_service_variant text, p_dog_ids uuid[], p_credits_spent integer, p_taxi_enabled boolean, p_taxi_distance_km numeric, p_taxi_price_eur numeric, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_capacity int;
  v_booked int;
  v_remaining int;

  v_first_booking_id uuid;
  v_row_id uuid;

  v_need_dogs boolean;
  v_count int;

  v_i int := 1;
  v_dog_id uuid;

  v_pass_id uuid;
begin
  -- ✅ Regola cani: consulenza NO; altri sì
  v_need_dogs := (coalesce(p_service_type,'') <> 'CONSULENZA');

  if v_need_dogs then
    if p_dog_ids is null or array_length(p_dog_ids, 1) is null or array_length(p_dog_ids, 1) = 0 then
      raise exception 'Seleziona almeno un cane';
    end if;
    v_count := array_length(p_dog_ids, 1);
  else
    v_count := 1;
  end if;

  -- credits_spent deve essere coerente col numero righe da creare (1 credito per cane / 1 per consulenza)
  if p_credits_spent <> v_count then
    raise exception 'Crediti non coerenti con i cani selezionati';
  end if;

  -- 1) Lock riga slot
  select capacity
  into v_capacity
  from public.service_slots
  where id = p_slot_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Slot non trovato o non attivo';
  end if;

  -- 2) Posti già occupati (1 riga = 1 posto)
  select count(*)::int
  into v_booked
  from public.service_slot_bookings
  where slot_id = p_slot_id
    and status in ('CONFIRMED', 'PAID');

  v_remaining := v_capacity - v_booked;

  if v_remaining < p_credits_spent then
    raise exception 'Slot esaurito o posti insufficienti (rimasti: %)', v_remaining;
  end if;

  -- 3) Inserisci una riga per "unità" (cane o consulenza)
  if v_need_dogs then
    foreach v_dog_id in array p_dog_ids loop
      -- scegli pass:
      -- - se p_pass_id è valorizzato => usa quello
      -- - altrimenti FIFO su pass con remaining > 0 per type+variant
      if p_pass_id is not null then
        select id
        into v_pass_id
        from public.service_passes
        where id = p_pass_id
          and user_id = p_user_id
        for update;

        if not found then
          raise exception 'Pass non valido';
        end if;

        -- controlla crediti
        if (select (credits_total - credits_used) from public.service_passes where id = v_pass_id) < 1 then
          raise exception 'Crediti insufficienti';
        end if;
      else
        select id
        into v_pass_id
        from public.service_passes
        where user_id = p_user_id
          and service_type = p_service_type
          and (service_variant is not distinct from p_service_variant)
          and status in ('ACTIVE') -- ✅ coerente col tuo enum
          and (credits_total - credits_used) > 0
        order by purchased_at asc
        limit 1
        for update;

        if not found then
          raise exception 'Crediti insufficienti';
        end if;
      end if;

      -- scala 1 credito dal pass scelto
      update public.service_passes
      set credits_used = credits_used + 1
      where id = v_pass_id
        and user_id = p_user_id;

      -- se finito, segna CONSUMED
      update public.service_passes
      set status = 'CONSUMED'
      where id = v_pass_id
        and user_id = p_user_id
        and (credits_total - credits_used) <= 0;

      insert into public.service_slot_bookings (
        user_id,
        slot_id,
        pass_id,
        service_type,
        service_variant,
        dog_id,
        dog_ids,
        credits_spent,
        taxi_enabled,
        taxi_distance_km,
        taxi_price_eur,
        status,
        notes
      )
      values (
        p_user_id,
        p_slot_id,
        v_pass_id,
        p_service_type,
        p_service_variant,
        v_dog_id,
        null, -- legacy
        1,
        case when v_i = 1 then coalesce(p_taxi_enabled,false) else false end,
        case when v_i = 1 then p_taxi_distance_km else null end,
        case when v_i = 1 then coalesce(p_taxi_price_eur, 0) else 0 end,
        'CONFIRMED',
        p_notes
      )
      returning id into v_row_id;

      if v_i = 1 then
        v_first_booking_id := v_row_id;
      end if;

      v_i := v_i + 1;
    end loop;
  else
    -- CONSULENZA: 1 sola riga, dog null, taxi off
    if p_pass_id is not null then
      select id
      into v_pass_id
      from public.service_passes
      where id = p_pass_id
        and user_id = p_user_id
      for update;

      if not found then
        raise exception 'Pass non valido';
      end if;

      if (select (credits_total - credits_used) from public.service_passes where id = v_pass_id) < 1 then
        raise exception 'Crediti insufficienti';
      end if;
    else
      select id
      into v_pass_id
      from public.service_passes
      where user_id = p_user_id
        and service_type = p_service_type
        and (service_variant is not distinct from p_service_variant)
        and status in ('ACTIVE')
        and (credits_total - credits_used) > 0
      order by purchased_at asc
      limit 1
      for update;

      if not found then
        raise exception 'Crediti insufficienti';
      end if;
    end if;

    update public.service_passes
    set credits_used = credits_used + 1
    where id = v_pass_id
      and user_id = p_user_id;

    update public.service_passes
    set status = 'CONSUMED'
    where id = v_pass_id
      and user_id = p_user_id
      and (credits_total - credits_used) <= 0;

    insert into public.service_slot_bookings (
      user_id,
      slot_id,
      pass_id,
      service_type,
      service_variant,
      dog_id,
      dog_ids,
      credits_spent,
      taxi_enabled,
      taxi_distance_km,
      taxi_price_eur,
      status,
      notes
    )
    values (
      p_user_id,
      p_slot_id,
      v_pass_id,
      p_service_type,
      p_service_variant,
      null,
      null,
      1,
      false,
      null,
      0,
      'CONFIRMED',
      p_notes
    )
    returning id into v_first_booking_id;
  end if;

  return v_first_booking_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_service_slot_booking(p_user_id uuid, p_booking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.chat_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_service_pass(p_product_id uuid)
 RETURNS service_passes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

-- Triggers
CREATE TRIGGER chat_conversations_set_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION chat_set_updated_at();

-- Enable RLS
ALTER TABLE booking_dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_slot_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "booking_dogs_select_own" ON booking_dogs AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = booking_dogs.booking_id) AND (b.user_id = auth.uid())))));
CREATE POLICY "bookings_select_own" ON bookings AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "chat_conversations_select_own_or_admin" ON chat_conversations AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM staff_accounts sa
  WHERE ((sa.user_id = auth.uid()) AND (sa.is_active = true) AND (sa.role = 'ADMIN'::text))))));
CREATE POLICY "chat_messages_select_own_or_admin" ON chat_messages AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM chat_conversations c
  WHERE ((c.id = chat_messages.conversation_id) AND (c.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM staff_accounts sa
  WHERE ((sa.user_id = auth.uid()) AND (sa.is_active = true) AND (sa.role = 'ADMIN'::text))))));
CREATE POLICY "customer_media_select_own" ON customer_media AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) AND (visible_until >= now())));
CREATE POLICY "dogs_select_own" ON dogs AS PERMISSIVE FOR SELECT TO authenticated USING ((owner_id = auth.uid()));
CREATE POLICY "notification_preferences_select_own" ON notification_preferences AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "notification_preferences_update_own" ON notification_preferences AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "notifications_select_own" ON notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "notifications_update_own" ON notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "profiles_select_own" ON profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "service_passes_select_own" ON service_passes AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "service_products_select_active_authenticated" ON service_products AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active = true));
CREATE POLICY "service_slot_bookings_delete_own" ON service_slot_bookings AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "service_slot_bookings_select_own" ON service_slot_bookings AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "service_slots_select_active_authenticated" ON service_slots AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active = true));
CREATE POLICY "staff_accounts_select_own" ON staff_accounts AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "staff_notifications_select_own" ON staff_notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "staff_notifications_update_own" ON staff_notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "user_documents_insert_own" ON user_documents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (status = 'PENDING'::text)));
CREATE POLICY "user_documents_select_own" ON user_documents AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

