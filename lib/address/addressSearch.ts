export type AddressSuggestion = {
  label: string;
  dog_address_line: string;
  dog_city: string;
  dog_zip_code: string;
  dog_province: string;
};

export type AddressSearchApiResponse =
  | { ok: true; items: AddressSuggestion[] }
  | { ok: false; error: string };
