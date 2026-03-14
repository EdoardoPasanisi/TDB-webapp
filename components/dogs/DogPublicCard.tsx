// components/dogs/DogPublicCard.tsx
'use client';

import { formatTemperamentsForDisplay, getAgeLabel } from '@/lib/dogs/dogDisplay';
import type { DogSex } from '@/types/dog';
import { Card, CardContent } from '@/components/ui/Card';

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

function buildDogPhotoPublicUrl(photoPath: string, updatedAt?: string | null): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  const normalizedPath = photoPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  if (!normalizedPath) return null;

  const base = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/dog-images/${normalizedPath}`;
  const version = updatedAt ? encodeURIComponent(updatedAt) : null;
  return version ? `${base}?v=${version}` : base;
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
  const photoUrl = dog.photo_path ? buildDogPhotoPublicUrl(dog.photo_path, dog.updated_at) : null;

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
    <Card className="w-full">
      <CardContent className="space-y-4">
        <header className="ui-dividerBottom pb-4">
          {photoUrl ? (
            <div className="flex items-center gap-3">
              <div
                className="ui-mediaFrame ui-mediaFrame--rounded overflow-hidden shrink-0"
                style={{ width: 72, height: 72 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Foto cane" className="block h-full w-full max-h-full max-w-full object-cover" />
              </div>
              <div className="min-w-0">
                <h1 className="ui-h2 truncate">{dog.name}</h1>
                {subtitleParts.length > 0 ? <p className="mt-1 ui-muted">{subtitleParts.join(' • ')}</p> : null}
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <h1 className="ui-h2 truncate">{dog.name}</h1>
              {subtitleParts.length > 0 ? <p className="mt-1 ui-muted">{subtitleParts.join(' • ')}</p> : null}
            </div>
          )}
        </header>

        {lines.length > 0 ? (
          <section className="space-y-2">
            {lines.map((line) => (
              <div key={line.key} className="ui-panelInset p-3">
                <p className="ui-muted">{line.label}</p>
                <p className="ui-body mt-1 whitespace-pre-line break-words">{line.value}</p>
              </div>
            ))}
          </section>
        ) : (
          <section className="ui-panelInset p-3">
            <p className="ui-muted">Nessun dettaglio visibile nella scheda.</p>
          </section>
        )}

        {ownerBlock?.anyOwnerInfoVisible && owner ? (
          <section className="ui-dividerTop pt-4 space-y-2">
            <h2 className="ui-body font-[var(--font-weight-semibold)]">Contatti proprietario</h2>

            {ownerBlock.ownerNameVisible ? (
              <div className="ui-panelInset p-3">
                <p className="ui-muted">Nome</p>
                <p className="ui-body mt-1">{ownerBlock.ownerName}</p>
              </div>
            ) : null}

            {ownerBlock.ownerPhoneVisible && owner.phone ? (
              <div className="ui-panelInset p-3">
                <p className="ui-muted">Telefono</p>
                <p className="ui-body mt-1">{owner.phone}</p>
              </div>
            ) : null}

            {ownerBlock.ownerEmailVisible && owner.email ? (
              <div className="ui-panelInset p-3">
                <p className="ui-muted">Email</p>
                <p className="ui-body mt-1 break-all">{owner.email}</p>
              </div>
            ) : null}

            {ownerBlock.ownerHomeAddressVisible && ownerBlock.homeAddress ? (
              <div className="ui-panelInset p-3">
                <p className="ui-muted">Indirizzo</p>
                <p className="ui-body mt-1">{ownerBlock.homeAddress}</p>
              </div>
            ) : null}

            {ownerBlock.ownerDogAddressVisible && ownerBlock.dogAddress ? (
              <div className="ui-panelInset p-3">
                <p className="ui-muted">Indirizzo cane</p>
                <p className="ui-body mt-1">{ownerBlock.dogAddress}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {showFooter ? (
          <footer className="pt-1">
            <p className="ui-muted text-center">Tenuta del Barone • Scheda cane</p>
          </footer>
        ) : null}
      </CardContent>
    </Card>
  );
}
