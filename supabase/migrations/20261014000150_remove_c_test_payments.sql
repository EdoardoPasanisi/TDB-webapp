-- I 6 pagamenti "C" erano prove fatte su clienti reali: i clienti non hanno pagato e
-- devono ancora quei soldi. Si eliminano i pagamenti con i loro movimenti (pagamento +
-- sconto), così il saldo torna a mostrare il dovuto reale:
--   Mirko Sgaramella 290 €, Simone Sgaramella 245 €, Giorgio Grimaldi 210 €,
--   Kozeta Gici 300 €, Alessia Micheloni 296 €, Francesco Zegretti 1.202 €.
-- Le prenotazioni che quei pagamenti avevano segnato "Pagata" (tutte concluse) tornano
-- "Completata". Resta "Pagata" la pensione 11–13/09 di Alessia Micheloni, che ha un
-- pagamento storico reale.
--
-- Va applicata PRIMA di 20261014000200_drop_payment_tag.sql (usa la colonna tag).

begin;

do $$
declare
  v_payment_ids uuid[] := array[
    '41213fcb-9ccf-4bdb-a32e-8f96072376e6',
    'b4e4a098-da76-4b84-b27e-13b67128f086',
    'aa8ebaa5-4d39-4c44-8761-d5c0fd066b6d',
    '32918bb8-9226-41d4-9e16-22d995349654',
    'ceadef4d-dea9-43a3-ad25-8f5871b2c0fe',
    'e9de7496-2afe-4c61-b043-b431885e5f22'
  ]::uuid[];
  v_booking_ids uuid[] := array[
    '133e8c43-f195-489a-b2bc-325884f7be1c',
    'cbb19a81-8dbc-4b53-bee2-cdcf06254a10',
    'e42c1e30-bdd0-46f0-b632-f5691b91e05b',
    'f6f401ef-77c3-4372-8984-f1ce443c1e72',
    '9de2a019-5557-43cd-8e90-6f36da943c89',
    '31096d54-a48b-4d6a-911c-99d12f5a8d78',
    '29b858df-26f8-47fa-b367-b3efa6885af7',
    'a483964e-4a92-43d8-a69f-91b17a7051b5',
    '9f513601-aa01-437e-aed4-fa9ae46f6144',
    'f943a1c5-a49b-430c-93f2-da2e636122de'
  ]::uuid[];
  v_count int;
begin
  -- Solo se sono ancora i 6 pagamenti C attesi: altrimenti non tocca niente.
  select count(*) into v_count from public.payments where id = any(v_payment_ids) and tag = 'C';
  if v_count <> 6 then
    raise exception 'Attesi 6 pagamenti C, trovati %: nessuna modifica', v_count;
  end if;

  delete from public.wallet_entries where source_type = 'PAYMENT' and source_id = any(v_payment_ids);
  delete from public.payments where id = any(v_payment_ids);

  update public.bookings
  set status = 'COMPLETED'
  where id = any(v_booking_ids) and status = 'PAID';
end $$;

commit;
