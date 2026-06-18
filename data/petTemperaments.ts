// Caratteri/temperamento per specie. Le selezioni salvate non più presenti in queste
// liste vengono semplicemente ignorate in UI (nessuna migrazione dati).
import type { DogSex, PetSpecies } from '@/types/dog';

export const DOG_TEMPERAMENTS = {
  socialita: ['Socievole', 'Riservato', 'Timido', 'Diffidente con estranei', 'Affettuoso', 'Indipendente'],
  energia: ['Tranquillo', 'Equilibrato', 'Vivace', 'Iperattivo', 'Giocherellone'],
  carattere: ['Obbediente', 'Testardo', 'Sensibile', 'Sicuro di sé', 'Ansioso', 'Curioso', 'Coraggioso'],
  convivenza: [
    'Buono con altri cani',
    'Buono con altri animali',
    'Buono con le persone',
    'Buono con i bambini',
    'Territoriale',
    'Protettivo',
  ],
} as const;

export const CAT_TEMPERAMENTS = {
  socialita: ['Socievole', 'Riservato', 'Timido', 'Diffidente con estranei', 'Affettuoso', 'Indipendente'],
  energia: ['Tranquillo', 'Pigro', 'Giocherellone', 'Vivace', 'Iperattivo'],
  carattere: ['Curioso', 'Coccolone', 'Schivo', 'Ansioso', 'Coraggioso', 'Vocale (miagola molto)'],
  convivenza: [
    'Buono con altri gatti',
    'Buono con i cani',
    'Buono con le persone',
    'Buono con i bambini',
    'Territoriale',
  ],
} as const;

const DOG_FLAT = Object.values(DOG_TEMPERAMENTS).flat();
const CAT_FLAT = Object.values(CAT_TEMPERAMENTS).flat();

export function temperamentOptionsForSpecies(species: PetSpecies): string[] {
  if (species === 'CAT') return CAT_FLAT;
  if (species === 'DOG') return DOG_FLAT;
  return []; // OTHER: nessun set predefinito
}

// Rende l'etichetta "gender-aware" solo per la UI (le chiavi salvate restano al maschile).
export function genderedTemperamentLabel(option: string, sex: DogSex | null): string {
  if (sex !== 'female') return option;

  if (option.startsWith('Buono ')) return option.replace(/^Buono\b/, 'Buona');
  if (option.startsWith('Sicuro ')) return option.replace(/^Sicuro\b/, 'Sicura');

  const parts = option.split(' ');
  const last = parts[parts.length - 1];
  if (last.endsWith('one')) {
    const lastFem = `${last.slice(0, -3)}ona`; // Giocherellone -> Giocherellona, Coccolone -> Coccolona
    return [...parts.slice(0, -1), lastFem].join(' ');
  }
  if (last.endsWith('o')) {
    const lastFem = `${last.slice(0, -1)}a`;
    return [...parts.slice(0, -1), lastFem].join(' ');
  }

  return option;
}
