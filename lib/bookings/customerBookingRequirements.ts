export type CustomerBookingRequirementProfile = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

const REQUIRED_CUSTOMER_BOOKING_FIELDS = [
  { key: 'first_name', label: 'Nome' },
  { key: 'last_name', label: 'Cognome' },
  { key: 'phone', label: 'Numero di telefono' },
] as const satisfies ReadonlyArray<{
  key: keyof CustomerBookingRequirementProfile;
  label: string;
}>;

export function getMissingRequiredCustomerBookingFields(
  profile: CustomerBookingRequirementProfile | null | undefined
): string[] {
  return REQUIRED_CUSTOMER_BOOKING_FIELDS.filter(({ key }) => {
    const value = profile?.[key];
    return typeof value !== 'string' || value.trim() === '';
  }).map(({ label }) => label);
}

export function buildMissingRequiredCustomerBookingMessage(missingFields: string[]): string {
  if (missingFields.length === 0) {
    return '';
  }

  return `Per completare la prenotazione devi compilare: ${missingFields.join(', ')}.`;
}
