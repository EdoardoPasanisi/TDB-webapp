// FILE: app/profile/page.tsx
'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import type { Profile } from '@/types/profile';
import type { Dog } from '@/types/dog';
import type { CustomerMediaViewItem } from '@/types/media';
import { getAgeLabel } from '@/lib/dogs/dogDisplay';
import { DogAvatar } from '@/components/dogs/DogAvatar';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ListItem } from '@/components/ui/ListItem';

function initials(first?: string | null, last?: string | null, email?: string | null) {
  const a = (first ?? '').trim().slice(0, 1).toUpperCase();
  const b = (last ?? '').trim().slice(0, 1).toUpperCase();
  const pair = `${a}${b}`.trim();
  if (pair) return pair;

  const localPart = (email ?? '').trim().split('@')[0] ?? '';
  const normalized = localPart.replace(/[^a-z0-9]+/gi, ' ').trim();
  if (!normalized) return 'TU';

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
  }

  return normalized.replace(/\s+/g, '').slice(0, 2).toUpperCase() || 'TU';
}

function ChevronMuted() {
  return <span className="ui-muted">›</span>;
}

function formatMediaDateTime(value: string) {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function AccountBanner({
  ownerPhotoPath,
  ownerInitials,
  ownerFullName,
  ownerEmail,
  onOpen,
  onOpenSettings,
  showMobileNav = false,
}: {
  ownerPhotoPath?: string | null;
  ownerInitials: string;
  ownerFullName: string;
  ownerEmail: string;
  onOpen: () => void;
  onOpenSettings: () => void;
  showMobileNav?: boolean;
}) {
  return (
    <div className="ui-profileHero md:rounded-[calc(var(--radius-xl)+4px)] md:shadow-[var(--shadow)]">
      {showMobileNav ? (
        <div className="ui-profileHeroTopbar md:hidden">
          <button
            type="button"
            onClick={onOpenSettings}
            className="ui-topbarIconBtn"
            aria-label="Impostazioni"
          >
            <Image src="/icon-settings.png" alt="" width={24} height={24} className="h-6 w-6" draggable={false} />
          </button>
          <NotificationBell
            buttonClassName="ui-topbarIconBtn"
            panelClassName="ui-notificationPanel--profile"
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        className="relative block w-full text-left"
        aria-label="Apri dati personali"
      >
        <div className="mx-auto w-full max-w-xl px-4 pb-6 pt-3 md:pt-5">
          <div className="flex items-center gap-3">
            <ProfileAvatar
              photoPath={ownerPhotoPath}
              alt={ownerFullName || 'Profilo proprietario'}
              initials={ownerInitials}
              className="ui-profileHeroAvatar overflow-hidden object-cover shrink-0"
              fallbackClassName="ui-profileHeroAvatar shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-extrabold truncate">
                {ownerFullName || 'Dati personali'}
              </div>
              <div className="ui-note ui-profileHeroMuted truncate">{ownerEmail || '—'}</div>
              <div className="mt-1 ui-fine ui-profileHeroMuted">
                Apri qui per gestire dati, documenti e liberatoria
              </div>
            </div>
            <div className="shrink-0 pl-1" aria-hidden="true">
              <span className="ui-profileHeroChevron">›</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function ProfileMobileBannerPortal({
  ownerPhotoPath,
  ownerInitials,
  ownerFullName,
  ownerEmail,
  onOpen,
  onOpenSettings,
}: {
  ownerPhotoPath?: string | null;
  ownerInitials: string;
  ownerFullName: string;
  ownerEmail: string;
  onOpen: () => void;
  onOpenSettings: () => void;
}) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!isClient || typeof document === 'undefined') return null;

  return createPortal(
    <section data-app-chrome="mobile-top" className="md:hidden fixed top-0 inset-x-0 z-50">
      <AccountBanner
        ownerPhotoPath={ownerPhotoPath}
        ownerInitials={ownerInitials}
        ownerFullName={ownerFullName}
        ownerEmail={ownerEmail}
        onOpen={onOpen}
        onOpenSettings={onOpenSettings}
        showMobileNav
      />
    </section>,
    document.body
  );
}

export default function ProfileOverviewPage() {
  const router = useRouter();

  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [mediaItems, setMediaItems] = useState<CustomerMediaViewItem[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadMedia = async (mediaId: string) => {
    setDownloadingId(mediaId);
    setMediaError(null);
    try {
      const response = await fetch(`/api/media/${mediaId}/download`, { credentials: 'include' });
      const json = (await response.json().catch(() => null)) as
        | { ok: true; url: string }
        | { ok: false; status?: string; error?: string }
        | null;

      if (json && json.ok && json.url) {
        const anchor = document.createElement('a');
        anchor.href = json.url;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        return;
      }

      setMediaError(
        (json && !json.ok && json.error) || 'Non siamo riusciti a preparare il download.'
      );
    } catch {
      setMediaError('Non siamo riusciti a preparare il download.');
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      setMediaError(null);

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(
            'user_id, photo_path, first_name, last_name, phone, address_line, city, zip_code, province, dog_address_line, dog_city, dog_zip_code, dog_province, email, show_owner_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card'
          )
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) setError(humanizeErrorMessage(profileError, 'Non siamo riusciti a caricare il profilo.'));
        setProfile((profileData as Profile | null) ?? null);

        const { data: dogsData, error: dogsError } = await supabase
          .from('dogs')
          .select(
            'id, owner_id, name, breed, size_category, grooming_difficulty, microchip, birth_date, notes, is_active, public_id, photo_path, updated_at, show_breed, show_microchip, show_birth_date, show_notes'
          )
          .eq('owner_id', user.id)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (dogsError) setError(humanizeErrorMessage(dogsError, 'Non siamo riusciti a caricare i pet.'));
        setDogs(((dogsData as Dog[]) ?? []).filter((d) => d.is_active));

        try {
          const mediaResponse = await fetch('/api/media', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          });
          const mediaJson = (await mediaResponse.json().catch(() => null)) as
            | { ok: true; items: CustomerMediaViewItem[] }
            | { ok: false; error?: string }
            | null;

          if (!mediaResponse.ok || !mediaJson?.ok) {
            setMediaItems([]);
            setMediaError(
              mediaJson && !mediaJson.ok && mediaJson.error
                ? mediaJson.error
                : 'Non siamo riusciti a caricare i media.'
            );
          } else {
            setMediaItems(mediaJson.items);
          }
        } catch (mediaErr) {
          console.error(mediaErr);
          setMediaItems([]);
          setMediaError('Non siamo riusciti a caricare i media.');
        }
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
    () => initials(profile?.first_name, profile?.last_name, profile?.email ?? user?.email ?? null),
    [profile?.first_name, profile?.last_name, profile?.email, user?.email]
  );

  if (authLoading || loading) {
    return (
      <main className="ui-page min-h-screen flex items-center justify-center">
        <p className="ui-muted">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="ui-page min-h-screen">
      <ProfileMobileBannerPortal
        ownerPhotoPath={profile?.photo_path ?? null}
        ownerInitials={ownerInitials}
        ownerFullName={ownerFullName}
        ownerEmail={ownerEmail}
        onOpen={() => router.push('/account')}
        onOpenSettings={() => router.push('/settings')}
      />

      <div className="md:hidden h-[164px]" />

      {/* contenuto */}
      <div className="mx-auto w-full max-w-xl px-4 pb-8 pt-6 space-y-6">
        <div className="hidden md:block">
          <AccountBanner
            ownerPhotoPath={profile?.photo_path ?? null}
            ownerInitials={ownerInitials}
            ownerFullName={ownerFullName}
            ownerEmail={ownerEmail}
            onOpen={() => router.push('/account')}
            onOpenSettings={() => router.push('/settings')}
          />
        </div>

        {error ? (
          <div className="ui-error">{error}</div>
        ) : null}

        {mediaError ? (
          <div className="ui-error">{mediaError}</div>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="ui-title text-[30px] leading-[0.95]">I miei pet</h2>
              <p className="mt-1 ui-body text-[18px] text-[var(--muted)]">
                {dogs.length ? `${dogs.length} profili` : 'Aggiungi il primo pet'}
              </p>
            </div>
            <div className="shrink-0">
              <Button variant="primary" onClick={() => router.push('/dogs/new')}>
                + Aggiungi
              </Button>
            </div>
          </div>

          {dogs.length === 0 ? (
            <Card>
              <CardContent className="ui-muted">
                Non hai ancora creato nessun pet.
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

        {mediaItems.length ? (
          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="ui-title text-[26px] leading-[1]">I miei media</h2>
              <p className="ui-muted">
                Foto e video recenti inviati durante la pensione. Restano visibili fino a 24 ore dopo la fine del servizio.
              </p>
            </div>

            <div className="grid gap-3">
              {mediaItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="ui-accentPill">
                        {item.mediaType === 'VIDEO' ? 'Video' : 'Foto'}
                      </span>
                      <span className="ui-fine text-[rgba(255,255,255,0.56)]">
                        {formatMediaDateTime(item.createdAt)}
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-[calc(var(--radius)+2px)] border border-[rgba(255,255,255,0.08)] bg-black">
                      {item.mediaType === 'VIDEO' ? (
                        item.status === 'ready' && item.mediaUrl ? (
                          <div className="relative aspect-video w-full bg-black">
                            <iframe
                              src={item.mediaUrl}
                              title={item.caption || 'Video del tuo pet'}
                              loading="lazy"
                              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                              allowFullScreen
                              className="absolute inset-0 h-full w-full border-0"
                            />
                          </div>
                        ) : (
                          <div className="flex aspect-video w-full items-center justify-center bg-black px-4 text-center">
                            <span className="ui-muted">
                              Video in elaborazione: sarà visibile tra pochi minuti.
                            </span>
                          </div>
                        )
                      ) : item.mediaUrl ? (
                        <img
                          src={item.mediaUrl}
                          alt={item.caption || 'Media del tuo pet'}
                          className="block h-auto max-h-[420px] w-full object-cover"
                        />
                      ) : null}
                    </div>

                    {item.caption ? <div className="ui-body">{item.caption}</div> : null}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="ui-fine text-[rgba(255,255,255,0.52)]">
                        Visibile fino al {formatMediaDateTime(item.visibleUntil)}
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => void downloadMedia(item.id)}
                        disabled={downloadingId === item.id || item.status !== 'ready'}
                      >
                        {downloadingId === item.id ? 'Preparazione…' : 'Scarica'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
