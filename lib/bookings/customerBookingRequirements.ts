import type { PetSpecies } from '@/types/dog';

// ── Proprietario ────────────────────────────────────────────────────────────
export type CustomerBookingRequirementProfile = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  fiscal_code?: string | null;
  address_line?: string | null;
  city?: string | null;
  zip_code?: string | null;
  province?: string | null;
  id_document_path?: string | null;
  id_document_back_path?: string | null;
  has_id_document?: boolean | null;
};

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

/**
 * Dati proprietario obbligatori per prenotare: nome, cognome, telefono, codice fiscale,
 * residenza completa, documento di identità caricato (anche se non ancora accettato).
 */
export function getMissingRequiredOwnerBookingFields(
  profile: CustomerBookingRequirementProfile | null | undefined
): string[] {
  const missing: string[] = [];

  if (isBlank(profile?.first_name)) missing.push('Nome');
  if (isBlank(profile?.last_name)) missing.push('Cognome');
  if (isBlank(profile?.phone)) missing.push('Numero di telefono');
  if (isBlank(profile?.fiscal_code)) missing.push('Codice fiscale');

  const hasCompleteResidence =
    !isBlank(profile?.address_line) &&
    !isBlank(profile?.city) &&
    !isBlank(profile?.zip_code) &&
    !isBlank(profile?.province);
  if (!hasCompleteResidence) missing.push('Residenza completa');

  // Servono entrambi i lati del documento (fronte + retro).
  const hasUploadedIdDocument =
    profile?.has_id_document === true ||
    (!isBlank(profile?.id_document_path) && !isBlank(profile?.id_document_back_path));
  if (!hasUploadedIdDocument) missing.push('Documento di identità (fronte e retro)');

  return missing;
}

// Alias retro-compatibile (usato da hook/route esistenti).
export const getMissingRequiredCustomerBookingFields = getMissingRequiredOwnerBookingFields;

// ── Pet ──────────────────────────────────────────────────────────────────────
export type CustomerBookingRequirementPet = {
  name?: string | null;
  species?: PetSpecies | null;
  birth_date?: string | null;
  microchip?: string | null;
  libretto_name?: string | null;
};

/**
 * Dati pet obbligatori per prenotare: anno di nascita; per i cani anche microchip e
 * nome sul libretto. Gatti e "altro" non richiedono microchip/libretto.
 */
export function getMissingRequiredPetBookingFields(
  pet: CustomerBookingRequirementPet | null | undefined
): string[] {
  const missing: string[] = [];
  const species = pet?.species ?? 'DOG';

  if (isBlank(pet?.birth_date)) missing.push('Anno di nascita');

  if (species === 'DOG') {
    if (isBlank(pet?.microchip)) missing.push('Microchip');
    if (isBlank(pet?.libretto_name)) missing.push('Nome sul libretto');
  }

  return missing;
}

export function buildMissingRequiredCustomerBookingMessage(missingFields: string[]): string {
  if (missingFields.length === 0) return '';
  return `Per completare la prenotazione devi compilare: ${missingFields.join(', ')}.`;
}
