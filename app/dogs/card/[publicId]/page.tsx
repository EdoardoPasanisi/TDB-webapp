// app/dogs/card/[publicId]/page.tsx
'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { DogPublicCard, type PublicDogCardDog, type PublicDogCardOwner } from '@/components/dogs/DogPublicCard';

async function loadOwnerProfile(ownerId: string): Promise<PublicDogCardOwner | null> {
  const select = `
    id,
    first_name, last_name, phone, email,
    address_line, city, zip_code, province,
    dog_address_line, dog_city, dog_zip_code, dog_province,
    show_first_name_on_dog_card,
    show_last_name_on_dog_card,
    show_phone_on_dog_card,
    show_email_on_dog_card,
    show_address_on_dog_card,
    show_dog_address_on_dog_card
  `;

  const r = await supabase.from('profiles').select(select).eq('user_id', ownerId).maybeSingle();
  if (r.error) throw new Error(r.error.message || 'Errore Supabase (profiles).');
  return (r.data as any) ?? null;
}

export default function PublicDogCardPage() {
  const params = useParams();
  const publicId = params?.publicId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dog, setDog] = useState<PublicDogCardDog | null>(null);
  const [owner, setOwner] = useState<PublicDogCardOwner | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      if (!publicId) {
        setError('Scheda non valida.');
        setLoading(false);
        return;
      }

      try {
        const { data: dogData, error: dogError } = await supabase
          .from('dogs')
          .select(
            `
            id, name, owner_id,
            updated_at,
            breed, sex, size_category,
            microchip, birth_date, notes,
            coat_color, temperament,
            photo_path,
            show_breed, show_sex, show_size, show_microchip, show_birth_date, show_notes,
            show_coat_color, show_temperament,
            public_id, is_active
          `
          )
          .eq('public_id', publicId)
          .eq('is_active', true)
          .single();

        if (dogError) {
          console.error('Errore load dog:', dogError);
          setError('Scheda non trovata.');
          setLoading(false);
          return;
        }

        if (!dogData) {
          setError('Scheda non trovata.');
          setLoading(false);
          return;
        }

        setDog(dogData as any);

        const ownerId = (dogData as any).owner_id as string;

        try {
          const ownerProfile = await loadOwnerProfile(ownerId);
          setOwner(ownerProfile);
        } catch (ownerErr: any) {
          console.error('Errore load owner:', ownerErr);
          setOwner(null);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Errore inatteso public dog card:', err);
        setError(err?.message || 'Errore inatteso.');
        setLoading(false);
      }
    };

    void load();
  }, [publicId]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <p className="text-sm text-gray-700">Caricamento scheda...</p>
      </main>
    );
  }

  if (error || !dog) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-md w-full text-center space-y-3">
          <h1 className="text-xl font-bold">Scheda non disponibile</h1>
          <p className="text-sm text-gray-700">{error ?? 'Scheda non trovata.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-gray-900">
      <div className="max-w-2xl mx-auto">
        <DogPublicCard dog={dog} owner={owner} showFooter />
      </div>
    </main>
  );
}
