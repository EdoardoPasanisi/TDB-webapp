// types/profile.ts

export interface Profile {
  user_id: string;

  photo_path: string | null;

  first_name: string | null;
  last_name: string | null;

  phone: string | null;
  email: string | null;

  // Indirizzo "casa"
  address_line: string | null;
  city: string | null;
  zip_code: string | null;
  province: string | null;

  // Dati aggiuntivi (solo per liberatoria/servizi)
  fiscal_code: string | null;
  birth_date: string | null; // "YYYY-MM-DD"

  // Indirizzo per ritiro/servizi (Taxi dog / indirizzo dei cani)
  dog_address_line: string | null;
  dog_city: string | null;
  dog_zip_code: string | null;
  dog_province: string | null;

  // Documento identità (NON pubblico)
  id_document_path: string | null;
  id_document_uploaded_at: string | null;

  // Soft-delete dal gestionale (null = utente attivo)
  deleted_at?: string | null;

  // Toggle visibilità scheda cane (globali utente)
  // (nome/cognome separati)
  show_first_name_on_dog_card: boolean | null;
  show_last_name_on_dog_card: boolean | null;

  show_phone_on_dog_card: boolean | null;
  show_email_on_dog_card: boolean | null;
  show_address_on_dog_card: boolean | null;

  // Indirizzo ritiro/servizi sulla scheda cane
  show_dog_address_on_dog_card: boolean | null;

  // Legacy (presente in DB ma non più usato in UI)
  show_owner_name_on_dog_card?: boolean | null;

  // Legacy: li lasciamo in DB ma NON li usiamo più sulla scheda cane
  show_fiscal_code_on_dog_card?: boolean | null;
  show_birth_date_on_dog_card?: boolean | null;
}
