// app/dogs/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { DogForm } from '@/components/dogs/DogForm';
import { createDogForOwner, uploadDogPhotoForOwner } from '@/lib/dogs/dogApi';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { supabase } from '@/lib/supabaseClient';
import type { PetSpecies } from '@/types/dog';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

function getErrorMessage(error: unknown): string {
  return humanizeErrorMessage(error, 'Non siamo riusciti a creare il profilo del pet. Riprova.');
}

const SPECIES_CARDS: { value: PetSpecies; label: string; icon: string; hint: string }[] = [
  { value: 'DOG', label: 'Cane', icon: '🐶', hint: 'Razza, microchip, libretto…' },
  { value: 'CAT', label: 'Gatto', icon: '🐱', hint: 'Razza felina, senza microchip' },
  { value: 'OTHER', label: 'Altro', icon: '🐾', hint: 'Indica tu la specie' },
];

export default function NewDogPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [species, setSpecies] = useState<PetSpecies | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  if (authLoading) {
    return (
      <main className="ui-page min-h-screen flex items-center justify-center">
        <p className="ui-muted">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  const handleSubmit = async (input: Parameters<typeof createDogForOwner>[1]) => {
    setSubmitting(true);
    setError(null);

    try {
      const dog = await createDogForOwner(user.id, input);

      if (photoFile) {
        setPhotoUploading(true);
        try {
          await uploadDogPhotoForOwner({ dogId: dog.id, file: photoFile });
        } finally {
          setPhotoUploading(false);
        }
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error('Sessione non valida');
        await fetch('/api/dog-public-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ dogId: dog.id }),
        });
      } catch (err) {
        console.error('Errore generazione scheda pubblica pet:', err);
      }

      router.replace(`/dogs/${dog.id}?created=1`);
    } catch (err) {
      console.error('NewDogPage – errore creazione pet:', err);
      setError(getErrorMessage(err));
      setSubmitting(false);
      setPhotoUploading(false);
    }
  };

  const speciesLabel = SPECIES_CARDS.find((card) => card.value === species)?.label ?? 'pet';

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-4 space-y-4">
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader
              title={species ? `Aggiungi ${speciesLabel.toLowerCase()}` : 'Aggiungi pet'}
              subtitle={species ? 'Compila i dati del pet e carica la foto' : 'Scegli il tipo di pet da aggiungere'}
              action={
                <Button
                  variant="secondary"
                  onClick={() => (species ? setSpecies(null) : router.push('/profile'))}
                >
                  Indietro
                </Button>
              }
            />
            {error ? <div className="ui-error">{error}</div> : null}
          </CardContent>
        </Card>

        {!species ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SPECIES_CARDS.map((card) => (
              <button
                key={card.value}
                type="button"
                onClick={() => setSpecies(card.value)}
                className="ui-clickable rounded-[var(--radius)] p-5 text-center"
              >
                <div className="text-5xl leading-none">{card.icon}</div>
                <div className="ui-h2 mt-3">{card.label}</div>
                <div className="ui-muted mt-1">{card.hint}</div>
              </button>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="space-y-3">
              <DogForm
                mode="create"
                initialSpecies={species}
                lockSpecies
                submitting={submitting}
                photoUploading={photoUploading}
                onPhotoSelected={setPhotoFile}
                onSubmit={handleSubmit}
                onCancel={() => setSpecies(null)}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
