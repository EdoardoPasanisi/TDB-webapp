// types/dog.ts

export type DogSize = 'toy' | 'piccola' | 'media' | 'grande' | 'gigante';
export type WashDifficulty = 1 | 2 | 3;

export type DogSex = 'male' | 'female';

// I "pet" sono righe della tabella dogs con una specie.
export type PetSpecies = 'DOG' | 'CAT' | 'OTHER';

export type Dog = {
  id: string;
  owner_id: string;

  created_at?: string | null;
  updated_at?: string | null;

  species: PetSpecies;
  // Testo libero "specie" quando species === 'OTHER'.
  species_other: string | null;
  // Nome sul libretto (solo cani; default = nome).
  libretto_name: string | null;

  name: string;
  breed: string | null;

  size_category: DogSize | null;
  grooming_difficulty: WashDifficulty | null;

  sex: DogSex | null;

  microchip: string | null;
  birth_date: string | null;
  notes: string | null;

  coat_color: string | null;
  temperament: string[] | null;

  weight_kg: number | null;
  origin_breeds: string[] | null;

  public_id?: string | null;
  is_active?: boolean | null;

  // ✅ NEW (soft start)
  photo_path?: string | null;

  show_breed: boolean | null;
  show_sex: boolean | null;
  show_size: boolean | null;
  show_microchip: boolean | null;
  show_birth_date: boolean | null;
  show_notes: boolean | null;
  show_coat_color: boolean | null;
  show_temperament: boolean | null;
  show_weight: boolean | null;
  show_origin_breeds: boolean | null;
};

export type DogInput = {
  species: PetSpecies;
  species_other: string | null;
  libretto_name: string | null;

  name: string;
  breed: string | null;

  size_category: DogSize | null;
  grooming_difficulty: WashDifficulty | null;

  sex: DogSex | null;

  microchip: string | null;
  birth_date: string | null;
  notes: string | null;

  coat_color: string | null;
  temperament: string[] | null;

  weight_kg: number | null;
  origin_breeds: string[] | null;

  show_breed: boolean;
  show_sex: boolean;
  show_size: boolean;
  show_microchip: boolean;
  show_birth_date: boolean;
  show_notes: boolean;
  show_coat_color: boolean;
  show_temperament: boolean;
  show_weight: boolean;
  show_origin_breeds: boolean;
};
