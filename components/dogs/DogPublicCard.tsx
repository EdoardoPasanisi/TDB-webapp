// components/dogs/DogPublicCard.tsx
'use client';

import { useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatTemperamentsForDisplay, getAgeLabel } from '@/lib/dogs/dogDisplay';
import type { DogSex } from '@/types/dog';

export type PublicDogCardDog = {
  id: string;
  name: string;

  updated_at?: string | null;

  breed: string | null;
  sex: DogSex | null;

  size_category: 'toy' | 'piccola' | 'media' | 'grande' | 'gigante' | null;

  microchip: string | null;
  birth_date: string | null;
  notes: string | null;

  coat_color: string | null;
  temperament: string[] | null;

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
};

export type PublicDogCardOwner = {
  id: string;

  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;

  address_line: string | null;
  city: string | null;
  zip_code: string | null;
  province: string | null;

  dog_address_line: string | null;
  dog_city: string | null;
  dog_zip_code: string | null;
  dog_province: string | null;

  show_first_name_on_dog_card: boolean | null;
  show_last_name_on_dog_card: boolean | null;
  show_phone_on_dog_card: boolean | null;
  show_email_on_dog_card: boolean | null;
  show_address_on_dog_card: boolean | null;
  show_dog_address_on_dog_card: boolean | null;
};

function coalesceBool(v: boolean | null | undefined, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function sexLabel(sex: DogSex | null): string {
  if (!sex) return '';
  return sex === 'male' ? 'Maschio' : 'Femmina';
}

function sizeLabel(v: PublicDogCardDog['size_category']): string {
  if (!v) return '';
  if (v === 'toy') return 'Toy';
  if (v === 'piccola') return 'Piccola';
  if (v === 'media') return 'Media';
  if (v === 'grande') return 'Grande';
  return 'Gigante';
}

function formatDDMMYYYY(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatAddress(line: string | null, city: string | null, zip: string | null, prov: string | null): string {
  const parts = [line, [zip, city].filter(Boolean).join(' '), prov]
    .filter(Boolean)
    .map((x) => String(x).trim());
  return parts.filter(Boolean).join(', ');
}

export function DogPublicCard({
  dog,
  owner,
  showFooter = true,
}: {
  dog: PublicDogCardDog;
  owner?: PublicDogCardOwner | null;
  showFooter?: boolean;
}) {
  const photoUrl = useMemo(() => {
    if (!dog.photo_path) return null;
    const { data } = supabase.storage.from('dog-images').getPublicUrl(dog.photo_path);
    const base = data?.publicUrl ?? null;
    if (!base) return null;
    const version = dog.updated_at ? encodeURIComponent(dog.updated_at) : null;
    return version ? `${base}?v=${version}` : base;
  }, [dog.photo_path, dog.updated_at]);

  const subtitleParts: string[] = [];
  if (dog.show_breed !== false && dog.breed) subtitleParts.push(dog.breed);
  if (dog.show_sex !== false && dog.sex) subtitleParts.push(sexLabel(dog.sex));

  const age = getAgeLabel(dog.birth_date);
  if (age) subtitleParts.push(age);

  const lines: { key: string; label: string; value: string }[] = [];

  if (dog.show_size === true && dog.size_category) {
    lines.push({ key: 'size', label: 'Taglia', value: sizeLabel(dog.size_category) });
  }

  if (dog.show_birth_date === true && dog.birth_date) {
    const d = formatDDMMYYYY(dog.birth_date);
    if (d) lines.push({ key: 'birth', label: 'Data di nascita', value: d });
  }

  if (dog.show_microchip === true && dog.microchip) {
    lines.push({ key: 'chip', label: 'Microchip', value: dog.microchip });
  }

  if (dog.show_coat_color === true && dog.coat_color) {
    lines.push({ key: 'coat', label: 'Colore mantello', value: dog.coat_color });
  }

  if (dog.show_temperament === true && dog.temperament && dog.temperament.length > 0) {
    const temps = formatTemperamentsForDisplay(dog.temperament, dog.sex);
    if (temps.length > 0) lines.push({ key: 'temp', label: 'Carattere', value: temps.join(', ') });
  }

  if (dog.show_notes === true && dog.notes) {
    lines.push({ key: 'notes', label: 'Note', value: dog.notes });
  }

  let ownerBlock: null | {
    ownerNameVisible: boolean;
    ownerName: string;
    ownerPhoneVisible: boolean;
    ownerEmailVisible: boolean;
    ownerHomeAddressVisible: boolean;
    ownerDogAddressVisible: boolean;
    homeAddress: string;
    dogAddress: string;
    anyOwnerInfoVisible: boolean;
  } = null;

  if (owner) {
    const firstNameVisible =
      coalesceBool(owner.show_first_name_on_dog_card, true) && !!(owner.first_name ?? '').trim();
    const lastNameVisible =
      coalesceBool(owner.show_last_name_on_dog_card, true) && !!(owner.last_name ?? '').trim();

    const ownerName = [firstNameVisible ? owner.first_name : null, lastNameVisible ? owner.last_name : null]
      .filter(Boolean)
      .join(' ')
      .trim();

    const ownerNameVisible = !!ownerName;

    const ownerPhoneVisible = coalesceBool(owner.show_phone_on_dog_card, true) && !!owner.phone;
    const ownerEmailVisible = coalesceBool(owner.show_email_on_dog_card, false) && !!owner.email;

    const ownerHomeAddressVisible =
      coalesceBool(owner.show_address_on_dog_card, false) &&
      !!(owner.address_line || owner.city || owner.zip_code || owner.province);

    const ownerDogAddressVisible =
      coalesceBool(owner.show_dog_address_on_dog_card, false) &&
      !!(owner.dog_address_line || owner.dog_city || owner.dog_zip_code || owner.dog_province);

    const homeAddress = formatAddress(owner.address_line, owner.city, owner.zip_code, owner.province);
    const dogAddress = formatAddress(owner.dog_address_line, owner.dog_city, owner.dog_zip_code, owner.dog_province);

    const anyOwnerInfoVisible =
      ownerNameVisible || ownerPhoneVisible || ownerEmailVisible || ownerHomeAddressVisible || ownerDogAddressVisible;

    ownerBlock = {
      ownerNameVisible,
      ownerName,
      ownerPhoneVisible,
      ownerEmailVisible,
      ownerHomeAddressVisible,
      ownerDogAddressVisible,
      homeAddress,
      dogAddress,
      anyOwnerInfoVisible,
    };
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 w-full max-w-md space-y-4">
      <header className="border-b border-gray-200 pb-3">
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <div className="h-16 w-16 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="Foto cane" className="h-full w-full object-cover" />
            </div>
          ) : null}

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{dog.name}</h1>
            {subtitleParts.length > 0 && (
              <p className="text-xs text-gray-600 mt-1">{subtitleParts.join(' • ')}</p>
            )}
          </div>
        </div>
      </header>


      <section className="space-y-2">
        {lines.length > 0 &&
          lines.map((l) => (
            <p key={l.key} className="text-sm text-gray-800">
              <span className="font-medium">{l.label}:</span> {l.value}
            </p>
          ))}
      </section>

      {ownerBlock?.anyOwnerInfoVisible && owner && (
        <section className="border-t border-gray-200 pt-3 space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Contatti proprietario</h2>

          {ownerBlock.ownerNameVisible && (
            <p className="text-sm text-gray-800">
              <span className="font-medium">Nome:</span> {ownerBlock.ownerName}
            </p>
          )}

          {ownerBlock.ownerPhoneVisible && owner.phone && (
            <p className="text-sm text-gray-800">
              <span className="font-medium">Telefono:</span> {owner.phone}
            </p>
          )}

          {ownerBlock.ownerEmailVisible && owner.email && (
            <p className="text-sm text-gray-800">
              <span className="font-medium">Email:</span> {owner.email}
            </p>
          )}

          {ownerBlock.ownerHomeAddressVisible && ownerBlock.homeAddress && (
            <p className="text-sm text-gray-800">
              <span className="font-medium">Indirizzo:</span> {ownerBlock.homeAddress}
            </p>
          )}

          {ownerBlock.ownerDogAddressVisible && ownerBlock.dogAddress && (
            <p className="text-sm text-gray-800">
              <span className="font-medium">Indirizzo cane:</span> {ownerBlock.dogAddress}
            </p>
          )}
        </section>
      )}

      {showFooter && (
        <footer className="text-center pt-2">
          <p className="text-[11px] text-gray-500">Tenuta del Barone • Scheda cane</p>
        </footer>
      )}
    </div>
  );
}
