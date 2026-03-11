// app/dogs/[dogId]/page.tsx
'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { DogForm } from '@/components/dogs/DogForm';
import { DogPublicCard, type PublicDogCardDog, type PublicDogCardOwner } from '@/components/dogs/DogPublicCard';
import { DogCardPreferencesModal } from '@/components/dogs/DogCardPreferencesModal';

import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import {
  getDogByIdForOwner,
  updateDogForOwner,
  softDeleteDogForOwner,
  uploadDogPhotoForOwner,
  setDogPhotoPathForOwner,
  removeDogPhotoForOwner,
} from '@/lib/dogs/dogApi';

import type { Dog, DogInput, DogSex } from '@/types/dog';
import { formatTemperamentsForDisplay, getAgeLabel } from '@/lib/dogs/dogDisplay';
import { supabase } from '@/lib/supabaseClient';

function sexLabel(sex: DogSex | null): string {
  if (!sex) return '';
  return sex === 'male' ? 'Maschio' : 'Femmina';
}

function formatDDMMYYYY(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function getDogPhotoPublicUrl(photoPath: string | null | undefined, updatedAt: string | null | undefined): string | null {
  if (!photoPath) return null;
  const { data } = supabase.storage.from('dog-images').getPublicUrl(photoPath);
  const base = data?.publicUrl ?? null;
  if (!base) return null;
  const v = updatedAt ? encodeURIComponent(updatedAt) : String(Date.now());
  return `${base}?v=${v}`;
}

/**
 * ✅ Next build-safe:
 * useSearchParams() deve stare sotto <Suspense/>
 */
export default function DogDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gray-100">
          <p className="text-sm text-gray-700">Caricamento...</p>
        </main>
      }
    >
      <DogDetailInner />
    </Suspense>
  );
}

function DogDetailInner() {
  const router = useRouter();
  const params = useParams();
  const dogId = (params?.dogId as string | undefined) ?? undefined;

  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [dog, setDog] = useState<Dog | null>(null);
  const [owner, setOwner] = useState<PublicDogCardOwner | null>(null);

  const [loadingDog, setLoadingDog] = useState(true);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const [submitting, setSubmitting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const searchParams = useSearchParams();
  const createdParam = searchParams.get('created');
  const [createdBanner, setCreatedBanner] = useState(false);

  useEffect(() => {
    if (!dogId) return;
    if (createdParam === '1') {
      setCreatedBanner(true);
      router.replace(`/dogs/${dogId}`);
    }
  }, [createdParam, dogId, router]);

  const loadOwnerProfile = async (userId: string) => {
    const r = await supabase
      .from('profiles')
      .select(
        `
        user_id,
        first_name, last_name, phone, email,
        address_line, city, zip_code, province,
        dog_address_line, dog_city, dog_zip_code, dog_province,
        show_first_name_on_dog_card,
        show_last_name_on_dog_card,
        show_phone_on_dog_card,
        show_email_on_dog_card,
        show_address_on_dog_card,
        show_dog_address_on_dog_card
      `
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (r.error) throw new Error(r.error.message);
    return (r.data as any) ?? null;
  };

  const loadDog = async () => {
    if (!user || !dogId) return;

    setLoadingDog(true);
    setError(null);

    try {
      const found = await getDogByIdForOwner(dogId, user.id);
      if (!found) {
        setError('Cane non trovato o non accessibile.');
        setDog(null);
      } else {
        setDog(found);
      }

      const profile = await loadOwnerProfile(user.id);
      setOwner(profile);
    } catch (err: any) {
      console.error('DogDetailPage – errore caricamento:', err);
      setError(err?.message || 'Errore nel caricamento.');
    } finally {
      setLoadingDog(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoadingDog(false);
      return;
    }
    void loadDog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, dogId]);

  const ageLabel = useMemo(() => getAgeLabel(dog?.birth_date ?? null), [dog?.birth_date]);

  const photoUrl = useMemo(
    () => getDogPhotoPublicUrl(dog?.photo_path ?? null, dog?.updated_at ?? null),
    [dog?.photo_path, dog?.updated_at]
  );

  if (authLoading || loadingDog) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-700">Caricamento cane...</p>
      </main>
    );
  }

  if (!user) return null;

  if (!dog) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow p-4 max-w-md w-full text-center space-y-3">
          <h1 className="text-lg font-semibold">Cane non trovato</h1>
          <p className="text-sm text-gray-700">{error ?? 'Impossibile caricare il cane.'}</p>
          <Button onClick={() => router.replace('/profile')} className="w-full">
            Torna all’area personale
          </Button>
        </div>
      </main>
    );
  }

  const handleSubmit = async (input: DogInput) => {
    if (!user || !dogId) return;

    setSubmitting(true);
    setError(null);

    try {
      const updated = await updateDogForOwner(dogId, user.id, input);

      let finalDog = updated;

      if (photoFile) {
        setPhotoUploading(true);
        try {
          const photoPath = await uploadDogPhotoForOwner({ ownerId: user.id, dogId, file: photoFile });
          finalDog = await setDogPhotoPathForOwner({ ownerId: user.id, dogId, photoPath });
        } finally {
          setPhotoUploading(false);
          setPhotoFile(null);
        }
      }

      setDog(finalDog);
      setMode('view');
    } catch (err: any) {
      console.error('DogDetailPage – errore aggiornamento cane:', err);
      setError(err?.message || 'Errore nel salvataggio del cane.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !dogId) return;

    setDeleting(true);
    setError(null);

    try {
      await softDeleteDogForOwner(dogId, user.id);
      router.replace('/profile');
    } catch (err: any) {
      console.error('DogDetailPage – errore eliminazione cane:', err);
      setError(err?.message || 'Errore durante l’eliminazione del cane.');
      setDeleting(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user || !dogId) return;

    setError(null);

    try {
      setPhotoUploading(true);
      await removeDogPhotoForOwner({ dogId });

      const refreshed = await getDogByIdForOwner(dogId, user.id);
      if (refreshed) setDog(refreshed);
    } catch (err: any) {
      console.error('DogDetailPage – errore rimozione foto:', err);
      setError(err?.message || 'Errore durante la rimozione della foto.');
    } finally {
      setPhotoUploading(false);
      setPhotoFile(null);
    }
  };

  const handleSaveCardPrefs = async (
    nextDogPrefs: {
      show_breed: boolean;
      show_sex: boolean;
      show_size: boolean;
      show_microchip: boolean;
      show_birth_date: boolean;
      show_notes: boolean;
      show_coat_color: boolean;
      show_temperament: boolean;
    },
    nextOwnerPrefs: {
      show_first_name_on_dog_card: boolean;
      show_last_name_on_dog_card: boolean;
      show_phone_on_dog_card: boolean;
      show_email_on_dog_card: boolean;
      show_address_on_dog_card: boolean;
      show_dog_address_on_dog_card: boolean;
    }
  ) => {
    if (!user || !dogId) return;

    setError(null);
    setPrefsSaving(true);

    try {
      const dogRes = await supabase
        .from('dogs')
        .update({
          show_breed: nextDogPrefs.show_breed,
          show_sex: nextDogPrefs.show_sex,
          show_size: nextDogPrefs.show_size,
          show_microchip: nextDogPrefs.show_microchip,
          show_birth_date: nextDogPrefs.show_birth_date,
          show_notes: nextDogPrefs.show_notes,
          show_coat_color: nextDogPrefs.show_coat_color,
          show_temperament: nextDogPrefs.show_temperament,
        })
        .eq('id', dogId)
        .eq('owner_id', user.id)
        .select('*')
        .single();

      if (dogRes.error) throw new Error(dogRes.error.message);
      setDog(dogRes.data as any);

      const profRes = await supabase
        .from('profiles')
        .update({
          show_first_name_on_dog_card: nextOwnerPrefs.show_first_name_on_dog_card,
          show_last_name_on_dog_card: nextOwnerPrefs.show_last_name_on_dog_card,
          show_phone_on_dog_card: nextOwnerPrefs.show_phone_on_dog_card,
          show_email_on_dog_card: nextOwnerPrefs.show_email_on_dog_card,
          show_address_on_dog_card: nextOwnerPrefs.show_address_on_dog_card,
          show_dog_address_on_dog_card: nextOwnerPrefs.show_dog_address_on_dog_card,
        })
        .eq('user_id', user.id)
        .select(
          `
          user_id,
          first_name, last_name, phone, email,
          address_line, city, zip_code, province,
          dog_address_line, dog_city, dog_zip_code, dog_province,
          show_first_name_on_dog_card,
          show_last_name_on_dog_card,
          show_phone_on_dog_card,
          show_email_on_dog_card,
          show_address_on_dog_card,
          show_dog_address_on_dog_card
        `
        )
        .maybeSingle();

      if (profRes.error) throw new Error(profRes.error.message);
      setOwner((profRes.data as any) ?? null);

      setPrefsOpen(false);
    } catch (err: any) {
      console.error('DogDetailPage – errore salvataggio preferenze scheda:', err);
      setError(err?.message || 'Errore nel salvataggio delle preferenze della scheda cane.');
    } finally {
      setPrefsSaving(false);
    }
  };

  const infoTemperaments =
    dog.temperament && dog.temperament.length > 0
      ? formatTemperamentsForDisplay(dog.temperament, dog.sex).join(', ')
      : null;

  const dogForCard = dog as unknown as PublicDogCardDog;

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-gray-900">
      {/* mobile-first: max width stretta, tutto in colonna */}
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header mobile-first: colonna + CTA full width */}
        <header className="bg-white rounded-lg shadow p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center shrink-0">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="Foto cane" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px] text-gray-500">Foto</span>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{dog.name}</h1>
              <p className="text-sm text-gray-600 truncate">
                {dog.breed ? dog.breed : ''}
                {dog.breed && ageLabel ? ' • ' : ''}
                {ageLabel ?? ''}
              </p>
            </div>
          </div>

          {mode === 'view' ? (
            <Button className="w-full" onClick={() => setMode('edit')}>
              Modifica
            </Button>
          ) : (
            <Button className="w-full" onClick={() => setMode('view')}>
              Annulla modifica
            </Button>
          )}
        </header>

        {createdBanner && (
          <div className="bg-green-50 border border-green-100 text-green-800 rounded-lg p-3 text-sm">
            ✅ Cane creato correttamente.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {mode === 'edit' ? (
          <section className="bg-white rounded-lg shadow p-4">
            <DogForm
              mode="edit"
              initialDog={dog}
              initialPhotoUrl={photoUrl}
              onPhotoSelected={setPhotoFile}
              photoUploading={photoUploading}
              onSubmit={handleSubmit}
              submitting={submitting}
              deleting={deleting}
              onDelete={handleDelete}
              onPhotoRemove={handleRemovePhoto}
              onCancel={() => setMode('view')}
            />
          </section>
        ) : (
          <>
            <section className="bg-white rounded-lg shadow p-4">
              <h2 className="text-base font-semibold mb-3">Informazioni</h2>

              <div className="space-y-2 text-sm text-gray-800">
                {dog.breed && (
                  <p>
                    <span className="font-medium">Razza:</span> {dog.breed}
                  </p>
                )}

                {dog.sex && (
                  <p>
                    <span className="font-medium">Sesso:</span> {sexLabel(dog.sex)}
                  </p>
                )}

                {dog.size_category && (
                  <p>
                    <span className="font-medium">Taglia:</span> {dog.size_category}
                  </p>
                )}

                {dog.birth_date && (
                  <p>
                    <span className="font-medium">Data di nascita:</span> {formatDDMMYYYY(dog.birth_date)}
                  </p>
                )}

                {dog.microchip && (
                  <p>
                    <span className="font-medium">Microchip:</span> {dog.microchip}
                  </p>
                )}

                {dog.coat_color && (
                  <p>
                    <span className="font-medium">Colore mantello:</span> {dog.coat_color}
                  </p>
                )}

                {infoTemperaments && (
                  <p>
                    <span className="font-medium">Carattere:</span> {infoTemperaments}
                  </p>
                )}

                {dog.notes && (
                  <p>
                    <span className="font-medium">Note:</span>{' '}
                    <span className="whitespace-pre-line">{dog.notes}</span>
                  </p>
                )}
              </div>
            </section>

            <section className="bg-white rounded-lg shadow p-4 space-y-3">
              <div className="space-y-2">
                <h2 className="text-base font-semibold">Scheda cane (anteprima)</h2>

                {/* mobile-first: due CTA full-width, una sotto l’altra */}
                <div className="grid gap-2">
                  <Button className="w-full" onClick={() => setPrefsOpen(true)}>
                    Personalizza scheda cane
                  </Button>

                  <Button className="w-full" onClick={() => router.push(`/dogs/tag/${dog.id}`)}>
                    Vai al QR
                  </Button>
                </div>
              </div>

              <div className="flex justify-center">
                <DogPublicCard dog={dogForCard} owner={owner} showFooter={false} />
              </div>

              <p className="text-[11px] text-gray-500">
                Questa è un’anteprima: è identica alla scheda pubblica generata dal QR.
              </p>
            </section>

            <DogCardPreferencesModal
              open={prefsOpen}
              dog={dog}
              owner={owner}
              saving={prefsSaving}
              onClose={() => setPrefsOpen(false)}
              onSave={async (dogPrefs, ownerPrefs) => {
                await handleSaveCardPrefs(dogPrefs, ownerPrefs);
              }}
            />
          </>
        )}

        {/* Footer mobile-first: CTA full-width */}
        <div className="pb-6">
          <Button className="w-full" onClick={() => router.push('/profile')}>
            Torna all’area personale
          </Button>
        </div>
      </div>
    </main>
  );
}