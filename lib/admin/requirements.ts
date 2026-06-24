// Regole "dati mancanti" condivise client/server (nessun 'use client': usabile anche
// nel data layer admin per calcolare i mancanti su dati reali senza esporre i valori).
import type { Profile } from '@/types/profile';

export function buildRequiredOwnerMissing(profile: Profile | null | undefined): string[] {
  if (!profile) {
    return [
      'Nome',
      'Cognome',
      'Email',
      'Codice fiscale',
      'Data di nascita',
      'Indirizzo completo',
      'Documento di identità (fronte e retro)',
    ];
  }

  const missing: string[] = [];

  if (!String(profile.first_name ?? '').trim()) missing.push('Nome');
  if (!String(profile.last_name ?? '').trim()) missing.push('Cognome');
  if (!String(profile.email ?? '').trim()) missing.push('Email');
  if (!String(profile.fiscal_code ?? '').trim()) missing.push('Codice fiscale');
  if (!String(profile.birth_date ?? '').trim()) missing.push('Data di nascita');

  const hasCompleteAddress =
    !!String(profile.address_line ?? '').trim() &&
    !!String(profile.city ?? '').trim() &&
    !!String(profile.zip_code ?? '').trim() &&
    !!String(profile.province ?? '').trim();

  if (!hasCompleteAddress) missing.push('Indirizzo completo');

  const hasIdFront = !!String(profile.id_document_path ?? '').trim();
  const hasIdBack = !!String(profile.id_document_back_path ?? '').trim();
  if (!hasIdFront || !hasIdBack) missing.push('Documento di identità (fronte e retro)');

  return missing;
}

export function buildRequiredDogMissing(dog: { microchip?: string | null } | null | undefined): string[] {
  const missing: string[] = [];
  if (!String(dog?.microchip ?? '').trim()) missing.push('Numero microchip');
  return missing;
}
