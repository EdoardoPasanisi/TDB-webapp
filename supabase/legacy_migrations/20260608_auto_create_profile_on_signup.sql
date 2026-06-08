-- Garantisce che ogni utente in auth.users abbia sempre una riga in public.profiles,
-- indipendentemente dal successo del callback di conferma email (/auth/callback).
--
-- Contesto: storicamente il profilo veniva creato SOLO nel route handler
-- app/auth/callback/route.ts dopo la conferma email. Se quel callback falliva
-- (es. exchangeCodeForSession PKCE non riuscito perché il link è aperto su un
-- altro browser/dispositivo o per prefetch dell'email), l'utente restava in
-- auth.users e poteva usare l'app/chat, ma non compariva mai in profiles.
--
-- Questa migration sposta la creazione del profilo su un trigger DB, così il
-- profilo esiste sempre alla registrazione, e fa il backfill degli utenti orfani.

-- 1) Funzione che crea il profilo per ogni nuovo utente auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

-- 2) Trigger su auth.users: crea il profilo subito alla registrazione.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 3) Backfill: crea i profili mancanti per gli utenti già registrati (utenti orfani).
insert into public.profiles (user_id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;
