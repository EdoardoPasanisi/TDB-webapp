'use client';

import { useEffect, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type {
  AdminAgendaItem,
  AdminDogDetail,
  AdminDogListItem,
} from '@/lib/admin/types';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import type { Dog, DogInput } from '@/types/dog';
import type { BookingStatus } from '@/types/booking';
import type { ServiceStatus } from '@/types/services';
import { DogForm } from '@/components/dogs/DogForm';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  SEARCH_DEBOUNCE_MS,
  cx,
  formatDateTime,
  formatDogSexLabel,
  EmptyCard,
  ErrorCard,
  LoadingCard,
  SummaryBlock,
  TimelineCard,
} from '@/components/admin/shared';
import { BookingDetailModal, UserDetailModal } from '@/components/admin/modals';
import { Button } from '@/components/ui/Button';

export function DogsTab({ canManage }: { canManage: boolean }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [listState, setListState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminDogListItem[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDogDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingDog, setSavingDog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdminAgendaItem | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const hasQuery = debouncedQuery.trim().length > 0;

  const loadDogs = async () => {
    setListState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<{ items: AdminDogListItem[] }>(
        `/api/admin/dogs?q=${encodeURIComponent(debouncedQuery)}`
      );
      setItems(data.items);
      setSelectedDogId((current) => (current && data.items.some((item) => item.dogId === current) ? current : data.items[0]?.dogId ?? null));
      setListState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare l’elenco dei cani.'));
      setListState('error');
    }
  };

  const loadDetail = async (dogId: string) => {
    setDetailState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<AdminDogDetail>(`/api/admin/dogs/${dogId}`);
      setDetail(data);
      setEditing(false);
      setDetailState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare il dettaglio del cane.'));
      setDetailState('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setListState('loading');
    setError(null);

    fetchAdminJson<{ items: AdminDogListItem[] }>(`/api/admin/dogs?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setItems(data.items);
        setSelectedDogId((current) =>
          current && data.items.some((item) => item.dogId === current) ? current : null
        );
        setListState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare l’elenco dei cani.'));
        setListState('error');
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  useEffect(() => {
    if (!selectedDogId) {
      setDetail(null);
      setDetailState('idle');
      return;
    }

    const controller = new AbortController();
    setDetailState('loading');
    setError(null);

    fetchAdminJson<AdminDogDetail>(`/api/admin/dogs/${selectedDogId}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setDetail(data);
        setEditing(false);
        setDetailState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare il dettaglio del cane.'));
        setDetailState('error');
      });

    return () => controller.abort();
  }, [selectedDogId]);

  const saveDog = async (input: DogInput) => {
    if (!selectedDogId) return;
    setSavingDog(true);
    setError(null);
    try {
      await fetchAdminJson<Dog>(`/api/admin/dogs/${selectedDogId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      await Promise.all([loadDogs(), loadDetail(selectedDogId)]);
      setEditing(false);
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare le modifiche del cane.'));
    } finally {
      setSavingDog(false);
    }
  };

  const handleBookingStatus = async (item: AdminAgendaItem, status: BookingStatus | ServiceStatus) => {
    const kind = item.kind === 'SERVICE_SLOT' ? 'service-slot' : 'pensione';
    await fetchAdminJson(`/api/admin/bookings/${kind}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (selectedDogId) await loadDetail(selectedDogId);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="Ricerca cani" subtitle="Cerca per nome, razza, microchip o dati del proprietario." />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ui-control ui-input"
              placeholder="Cerca cane..."
            />
          </CardContent>
        </Card>

        {listState === 'loading' ? <LoadingCard label="Caricamento cani..." /> : null}
        {listState === 'error' ? <ErrorCard error={error ?? 'Errore cani.'} onRetry={loadDogs} /> : null}
        {listState === 'ready' && items.length === 0 ? (
          <EmptyCard label={hasQuery ? 'Nessun cane trovato.' : 'Nessun cane registrato.'} />
        ) : null}

        {items.map((item) => (
          <button
            key={item.dogId}
            type="button"
            onClick={() => setSelectedDogId(item.dogId)}
            className={cx('min-w-0 w-full text-left', selectedDogId === item.dogId && 'admin-selectedCard')}
          >
            <Card className="admin-listCard overflow-hidden">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="ui-body font-[var(--font-weight-semibold)] truncate">{item.name}</div>
                    <div className="ui-muted truncate">{item.ownerName}</div>
                  </div>
                  <span className="ui-accentPill">{item.activeBookings} attive</span>
                </div>
                <div className="ui-muted">{item.breed ?? 'Razza non specificata'}</div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="min-w-0 space-y-4">
        {error ? <div className="ui-error">{error}</div> : null}
        {detailState === 'loading' ? (
          <LoadingCard label="Caricamento dettaglio cane..." />
        ) : detailState === 'error' || !detail ? (
          <EmptyCard label="Seleziona un cane per vedere proprietario, storico e prenotazioni." />
        ) : (
          <>
            <Card>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <h2 className="ui-title">{detail.dog.name}</h2>
                    <div className="ui-muted">
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:underline"
                        onClick={() => setSelectedOwnerId(detail.dog.owner_id)}
                      >
                        {detail.owner?.first_name || detail.owner?.last_name
                          ? `${detail.owner?.first_name ?? ''} ${detail.owner?.last_name ?? ''}`.trim()
                          : 'Proprietario non compilato'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="ui-accentPill">{detail.dog.breed ?? 'Razza non specificata'}</span>
                      {detail.dog.microchip ? <span className="ui-accentPill">Microchip {detail.dog.microchip}</span> : null}
                      {detail.ownerStaffRole ? <span className="ui-accentPill">{detail.ownerStaffRole}</span> : null}
                    </div>
                  </div>
                  {canManage ? (
                    <Button variant="secondary" onClick={() => setEditing((current) => !current)}>
                      {editing ? 'Chiudi modifica' : 'Modifica cane'}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader title="Riepilogo cane" subtitle="Informazioni principali del profilo cane." />
                <div className="grid gap-3 md:grid-cols-2">
                  <SummaryBlock label="Razza" value={detail.dog.breed ?? '—'} />
                  <SummaryBlock label="Taglia" value={detail.dog.size_category ?? '—'} />
                  <SummaryBlock label="Sesso" value={formatDogSexLabel(detail.dog.sex) ?? '—'} />
                  <SummaryBlock label="Microchip" value={detail.dog.microchip ?? '—'} />
                  <SummaryBlock label="Data nascita" value={detail.dog.birth_date ? formatDateTime(detail.dog.birth_date) : '—'} />
                  <SummaryBlock
                    label="Temperamento"
                    value={detail.dog.temperament?.length ? detail.dog.temperament.join(', ') : '—'}
                  />
                </div>
                {detail.dog.notes ? <SummaryBlock label="Note" value={detail.dog.notes} /> : null}
              </CardContent>
            </Card>

            {editing && canManage ? (
              <Card>
                <CardContent>
                  <DogForm
                    mode="edit"
                    initialDog={detail.dog}
                    onSubmit={saveDog}
                    submitting={savingDog}
                    photoEnabled={false}
                    allowManualSize
                    onCancel={() => setEditing(false)}
                  />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader title="Prenotazioni attive" subtitle="Servizi correnti e futuri del cane." />
                {detail.activeTimeline.length ? (
                  <div className="space-y-3">
                    {detail.activeTimeline.map((item) => (
                      <TimelineCard
                        key={item.itemKey}
                        item={item}
                        canManage={canManage}
                        showUser={false}
                        onOpenDetail={() => setSelectedBooking(item)}
                        onStatusChange={(status) => handleBookingStatus(item, status)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyCard label="Nessuna prenotazione attiva per questo cane." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader title="Storico" subtitle="Cronologia servizi completati o passati del cane." />
                {detail.historyTimeline.length ? (
                  <div className="space-y-3">
                    {detail.historyTimeline.map((item) => (
                      <TimelineCard
                        key={item.itemKey}
                        item={item}
                        canManage={false}
                        showUser={false}
                        onOpenDetail={() => setSelectedBooking(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyCard label="Storico cane vuoto." />
                )}
              </CardContent>
            </Card>

            <UserDetailModal
              key={selectedOwnerId ?? 'dogs-user-detail-empty'}
              userId={selectedOwnerId}
              open={Boolean(selectedOwnerId)}
              onClose={() => setSelectedOwnerId(null)}
              canManage={canManage}
            />
            <BookingDetailModal
              key={selectedBooking ? `${selectedBooking.kind}-${selectedBooking.id}` : 'dogs-booking-detail-empty'}
              item={selectedBooking}
              open={Boolean(selectedBooking)}
              onClose={() => setSelectedBooking(null)}
              canManage={canManage}
              onDeleted={() => {
                if (selectedDogId) void loadDetail(selectedDogId);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
