-- 20260615_dog_weight_and_origin_breeds.sql
-- Aggiunge al cane:
--   - weight_kg: peso facoltativo (kg)
--   - origin_breeds: razze d'origine per i meticci (facoltative)
--   - show_weight / show_origin_breeds: visibilità sulla scheda pubblica
-- Tutto idempotente.

alter table public.dogs
  add column if not exists weight_kg numeric,
  add column if not exists origin_breeds text[],
  add column if not exists show_weight boolean not null default false,
  add column if not exists show_origin_breeds boolean not null default false;
