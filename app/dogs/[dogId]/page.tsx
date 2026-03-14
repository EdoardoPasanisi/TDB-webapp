// app/dogs/[dogId]/page.tsx
'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
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

function sizeLabel(value: Dog['size_category']): string {
  if (!value) return '';
  if (value === 'toy') return 'Toy';
  if (value === 'piccola') return 'Piccola';
  if (value === 'media') return 'Media';
  if (value === 'grande') return 'Grande';
  return 'Gigante';
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
        <main className="ui-page min-h-screen flex items-center justify-center">
          <p className="ui-muted">Caricamento...</p>
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
      <main className="ui-page min-h-screen flex items-center justify-center">
        <p className="ui-muted">Caricamento cane...</p>
      </main>
    );
  }

  if (!user) return null;

  if (!dog) {
    return (
      <main className="ui-page min-h-screen p-4">
        <div className="mx-auto w-full max-w-xl pt-8">
          <Card>
            <CardContent className="space-y-3 text-center">
              <h1 className="ui-h2">Cane non trovato</h1>
              <p className="ui-body">{error ?? 'Impossibile caricare il cane.'}</p>
              <Button fullWidth onClick={() => router.replace('/profile')}>
                Torna all’area personale
              </Button>
            </CardContent>
          </Card>
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
    <main className="ui-page min-h-screen p-4">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="ui-mediaFrame ui-mediaFrame--rounded overflow-hidden flex items-center justify-center shrink-0"
                style={{ width: 72, height: 72 }}
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Foto cane" className="block h-full w-full max-h-full max-w-full object-cover" />
                ) : (
                  <span className="ui-muted">Foto</span>
                )}
              </div>

              <div className="min-w-0">
                <h1 className="ui-h2 truncate">{dog.name}</h1>
                <p className="ui-muted truncate">
                  {dog.breed ? dog.breed : ''}
                  {dog.breed && ageLabel ? ' • ' : ''}
                  {ageLabel ?? ''}
                </p>
              </div>
            </div>

            {mode === 'view' ? (
              <Button fullWidth onClick={() => setMode('edit')}>
                Modifica
              </Button>
            ) : (
              <Button fullWidth variant="secondary" onClick={() => setMode('view')}>
                Annulla modifica
              </Button>
            )}
          </CardContent>
        </Card>

        {createdBanner ? (
          <div className="ui-success">
            <p className="ui-body">Cane creato correttamente.</p>
          </div>
        ) : null}

        {error ? <div className="ui-error">{error}</div> : null}

        {mode === 'edit' ? (
          <Card>
            <CardContent>
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
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="space-y-3">
                <SectionHeader title="Informazioni" />

                <div className="space-y-2">
                  {dog.breed ? (
                    <div className="ui-panelInset p-3">
                      <p className="ui-muted">Razza</p>
                      <p className="ui-body mt-1">{dog.breed}</p>
                    </div>
                  ) : null}

                  {dog.sex ? (
                    <div className="ui-panelInset p-3">
                      <p className="ui-muted">Sesso</p>
                      <p className="ui-body mt-1">{sexLabel(dog.sex)}</p>
                    </div>
                  ) : null}

                  {dog.size_category ? (
                    <div className="ui-panelInset p-3">
                      <p className="ui-muted">Taglia</p>
                      <p className="ui-body mt-1">{sizeLabel(dog.size_category)}</p>
                    </div>
                  ) : null}

                  {dog.birth_date ? (
                    <div className="ui-panelInset p-3">
                      <p className="ui-muted">Data di nascita</p>
                      <p className="ui-body mt-1">{formatDDMMYYYY(dog.birth_date)}</p>
                    </div>
                  ) : null}

                  {dog.microchip ? (
                    <div className="ui-panelInset p-3">
                      <p className="ui-muted">Microchip</p>
                      <p className="ui-body mt-1 break-all">{dog.microchip}</p>
                    </div>
                  ) : null}

                  {dog.coat_color ? (
                    <div className="ui-panelInset p-3">
                      <p className="ui-muted">Colore mantello</p>
                      <p className="ui-body mt-1">{dog.coat_color}</p>
                    </div>
                  ) : null}

                  {infoTemperaments ? (
                    <div className="ui-panelInset p-3">
                      <p className="ui-muted">Carattere</p>
                      <p className="ui-body mt-1">{infoTemperaments}</p>
                    </div>
                  ) : null}

                  {dog.notes ? (
                    <div className="ui-panelInset p-3">
                      <p className="ui-muted">Note</p>
                      <p className="ui-body mt-1 whitespace-pre-line">{dog.notes}</p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader
                  title="Scheda cane (anteprima)"
                  subtitle="Questa anteprima è identica alla scheda pubblica generata dal QR."
                />

                <div className="grid gap-2">
                  <Button fullWidth variant="secondary" onClick={() => setPrefsOpen(true)}>
                    Personalizza scheda cane
                  </Button>
                  <Button fullWidth variant="primary" onClick={() => router.push(`/dogs/tag/${dog.id}`)}>
                    Vai al QR
                  </Button>
                </div>

                <DogPublicCard dog={dogForCard} owner={owner} showFooter={false} />
              </CardContent>
            </Card>

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

      </div>
    </main>
  );
}
