-- Tolta la funzione "Elimina tutti i pagamenti C" (e i pulsanti C / CC in
-- "Segna come pagato"). Il log delle pulizie era vuoto: il pulsante non è mai stato usato.
--
-- La colonna payments.tag resta: i pagamenti già registrati conservano la loro
-- etichetta (C / CC) come dato storico; i nuovi pagamenti vengono salvati senza tag.

begin;

drop function if exists public.delete_tagged_payments(text, uuid);
drop table if exists public.data_cleanup_log;

commit;
