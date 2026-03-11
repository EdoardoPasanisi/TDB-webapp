// types/forms.ts

export type ProfileFormState = {
  first_name: string;
  last_name: string;

  phone: string;
  email: string;

  // Indirizzo "casa"
  address_line: string;
  city: string;
  zip_code: string;
  province: string;

  // Dati aggiuntivi (per liberatoria/servizi)
  fiscal_code: string;
  birth_date: string; // "YYYY-MM-DD"

  // Indirizzo per ritiro/servizi (Taxi dog / indirizzo dei cani)
  dog_address_same_as_home: boolean; // UI-only
  dog_address_line: string;
  dog_city: string;
  dog_zip_code: string;
  dog_province: string;

  // Toggle visibilità scheda cane pubblica (globali per l'utente)
  show_first_name_on_dog_card: boolean;
  show_last_name_on_dog_card: boolean;

  show_phone_on_dog_card: boolean;
  show_email_on_dog_card: boolean;
  show_address_on_dog_card: boolean;

  show_dog_address_on_dog_card: boolean;
};

export type DogSize = 'toy' | 'piccola' | 'media' | 'grande' | 'gigante';

export type DogFormState = {
  name: string;
  breed: string;
  size: DogSize;
  microchip: string;
  birth_date: string;
  notes: string;
};
