// FILE: app/profile/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import type { Profile } from '@/types/profile';
import type { Dog } from '@/types/dog';
import { getAgeLabel } from '@/lib/dogs/dogDisplay';
import { DogAvatar } from '@/components/dogs/DogAvatar';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ListItem } from '@/components/ui/ListItem';

function initials(first?: string | null, last?: string | null) {
  const a = (first ?? '').trim().slice(0, 1).toUpperCase();
  const b = (last ?? '').trim().slice(0, 1).toUpperCase();
  return `${a}${b}`.trim() || '👤';
}

function ChevronMuted() {
  return <span className="text-xs text-[var(--muted)]">›</span>;
}

export default function ProfileOverviewPage() {
  const router = useRouter();

  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [dogs, setDogs] = useState<Dog[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(
            'user_id, first_name, last_name, phone, address_line, city, zip_code, province, email, show_owner_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card'
          )
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) setError(profileError.message);
        setProfile((profileData as Profile | null) ?? null);

        const { data: dogsData, error: dogsError } = await supabase
          .from('dogs')
          .select(
            'id, owner_id, name, breed, size_category, grooming_difficulty, microchip, birth_date, notes, is_active, public_id, photo_path, updated_at, show_breed, show_microchip, show_birth_date, show_notes'
          )
          .eq('owner_id', user.id)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (dogsError) setError(dogsError.message);
        setDogs(((dogsData as Dog[]) ?? []).filter((d) => d.is_active));
      } catch (e) {
        console.error(e);
        setError('Errore nel caricamento dei dati.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [authLoading, user]);

  const ownerFullName = useMemo(() => {
    const first = (profile?.first_name ?? '').trim();
    const last = (profile?.last_name ?? '').trim();
    return [first, last].filter(Boolean).join(' ').trim();
  }, [profile?.first_name, profile?.last_name]);

  const ownerEmail = useMemo(() => {
    const p = (profile?.email ?? '').trim();
    if (p) return p;
    return user?.email ?? '';
  }, [profile?.email, user?.email]);

  const ownerInitials = useMemo(
    () => initials(profile?.first_name, profile?.last_name),
    [profile?.first_name, profile?.last_name]
  );

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--brand-bg)]">
        <p className="text-sm text-[var(--muted)]">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[var(--brand-bg)] text-[var(--text)] -mt-[calc(var(--topbar-h)+12px)] md:mt-0">
      {/*
        Banner attaccato in alto:
        - mobile: compensiamo lo spazio della topbar del layout (che su /profile dovrebbe essere nascosta)
        - desktop: compensiamo l’eventuale padding-top del layout
      */}
      {/* ✅ Banner FIXED (mobile): resta fermo come navbar */}
      <section className="md:hidden fixed top-0 left-0 right-0 z-50">
        <button
          type="button"
          onClick={() => router.push('/account')}
          className="relative block w-full text-left"
          aria-label="Apri dati personali"
        >
          <div className="relative bg-[var(--brand-accent)] text-black">
            <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-10">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-black/10 border border-black/10 flex items-center justify-center text-sm font-extrabold">
                  {ownerInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-extrabold truncate">
                    {ownerFullName || 'Dati personali'}
                  </div>
                  <div className="text-xs text-black/70 truncate">{ownerEmail || '—'}</div>
                  <div className="mt-1 text-[11px] text-black/70">
                    Tocca qui per gestire dati, documenti e liberatoria
                  </div>
                </div>
              </div>
            </div>
          </div>
        </button>
      </section>

      {/* Spacer: altezza banner (mobile) */}
      <div className="md:hidden h-[140px]" />

      {/* contenuto */}
      <div className="mx-auto w-full max-w-xl px-4 pb-8 pt-4 space-y-6">
        {error ? (
          <Card className="border border-red-500/30">
            <CardContent className="text-sm text-red-300">{error}</CardContent>
          </Card>
        ) : null}

        <section className="space-y-3">
          <SectionHeader
            title="I tuoi cani"
            subtitle={dogs.length ? `${dogs.length} profili` : 'Aggiungi il primo cane'}
            action={
              <Button variant="primary" onClick={() => router.push('/dogs/new')}>
                + Aggiungi
              </Button>
            }
          />

          {dogs.length === 0 ? (
            <Card>
              <CardContent className="text-sm text-[var(--muted)]">
                Non hai ancora creato nessun cane.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {dogs.map((dog) => {
                const age = getAgeLabel(dog.birth_date ?? null);
                return (
                  <ListItem
                    key={dog.id}
                    onClick={() => router.push(`/dogs/${dog.id}`)}
                    leading={
                      <DogAvatar
                        photoPath={dog.photo_path ?? null}
                        updatedAt={dog.updated_at ?? null}
                        alt={dog.name}
                        size={44}
                      />
                    }
                    title={dog.name}
                    subtitle={`${dog.breed ? dog.breed : 'Razza non specificata'}${age ? ` • ${age}` : ''}`}
                    trailing={<ChevronMuted />}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}