// app/dogs/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { DogForm } from '@/components/dogs/DogForm';
import { createDogForOwner, uploadDogPhotoForOwner, setDogPhotoPathForOwner } from '@/lib/dogs/dogApi';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Si è verificato un errore nella creazione del cane.';
}

export default function NewDogPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-700">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  const handleSubmit = async (input: Parameters<typeof createDogForOwner>[1]) => {
    setSubmitting(true);
    setError(null);

    try {
      const dog = await createDogForOwner(user.id, input);

      // ✅ upload foto (solo se selezionata)
      if (photoFile) {
        setPhotoUploading(true);
        try {
          const photoPath = await uploadDogPhotoForOwner({ ownerId: user.id, dogId: dog.id, file: photoFile });
          await setDogPhotoPathForOwner({ ownerId: user.id, dogId: dog.id, photoPath });
        } finally {
          setPhotoUploading(false);
        }
      }

      // genera/recupera public_id (non blocca se fallisce)
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error('Sessione non valida');

        await fetch('/api/dog-public-id', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ dogId: dog.id }),
        });
      } catch (err) {
        console.error('Errore generazione scheda pubblica cane:', err);
      }

      router.replace(`/dogs/${dog.id}?created=1`);
    } catch (err) {
      console.error('NewDogPage – errore creazione cane:', err);
      setError(getErrorMessage(err));
      setSubmitting(false);
      setPhotoUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 text-[var(--text)]">
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-4 space-y-4">
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader
              title="Aggiungi cane"
              subtitle="Crea il profilo del cane e carica la foto"
              action={
                <Button variant="secondary" onClick={() => router.push('/profile')}>
                  Indietro
                </Button>
              }
            />

            {error && (
              <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <DogForm
              mode="create"
              submitting={submitting}
              photoUploading={photoUploading}
              onPhotoSelected={setPhotoFile}
              onSubmit={handleSubmit}
              onCancel={() => router.push('/profile')}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
