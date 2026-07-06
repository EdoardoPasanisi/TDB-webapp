'use client';

import { useEffect, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { Button } from '@/components/ui/Button';
import type {
  AdminAgendaItem,
  AdminBookingDetail,
  AdminDogDetail,
  AdminUserDetail,
} from '@/lib/admin/types';
import {
  ModalFrame,
  LoadingCard,
  ErrorCard,
  EmptyCard,
  SummaryBlock,
  DetailSection,
  HighlightBox,
  MissingAlert,
  StatusBadge,
  TimelineCard,
  buildRequiredDogMissing,
  buildRequiredOwnerMissing,
  formatAccommodationTypeLabel,
  formatAddressValue,
  formatDateTime,
  formatDogSexLabel,
  formatEuro,
  formatGroomingDifficultyLabel,
  formatTaxiDistanceBandLabel,
  formatTaxiOptionLabel,
  formatTimeOnly,
  type LoadState,
} from '@/components/admin/shared';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { BookingEditModal } from '@/components/admin/BookingEditModal';
import { useConfirm } from '@/components/admin/ConfirmProvider';
import { buildDogCostLines } from '@/lib/services/pensione/breakdown';
import type { AccommodationKey } from '@/types/booking';

export function UserDetailModal({
  userId,
  open,
  onClose,
  canManage,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
}) {
  const [state, setState] = useState<LoadState>(() => (open && userId ? 'loading' : 'idle'));
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminAgendaItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open || !userId) return;

    const controller = new AbortController();

    fetchAdminJson<AdminUserDetail>(`/api/admin/users/${userId}`, { signal: controller.signal })
      .then((payload) => {
        setDetail(payload);
        setState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(
          humanizeErrorMessage(err, 'Non siamo riusciti a caricare il dettaglio del cliente.')
        );
        setState('error');
      });

    return () => controller.abort();
  }, [open, userId, reloadKey]);

  return (
    <ModalFrame
      open={open}
      title={
        detail?.profile?.first_name || detail?.profile?.last_name
          ? `${detail?.profile?.first_name ?? ''} ${detail?.profile?.last_name ?? ''}`.trim()
          : 'Dettaglio utente'
      }
      onClose={onClose}
      maxWidthClassName="sm:max-w-4xl"
    >
      {state === 'loading' || state === 'idle' ? <LoadingCard label="Caricamento utente..." /> : null}
      {state === 'error' ? <ErrorCard error={error ?? 'Errore dettaglio utente.'} /> : null}
      {state === 'ready' && detail ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryBlock label="Nome" value={detail.profile?.first_name ?? '—'} />
            <SummaryBlock label="Cognome" value={detail.profile?.last_name ?? '—'} />
            {canManage ? <SummaryBlock label="Email" value={detail.profile?.email ?? '—'} /> : null}
            {canManage ? <SummaryBlock label="Telefono" value={detail.profile?.phone ?? '—'} /> : null}
            {canManage ? (
              <SummaryBlock
                label="Residenza"
                value={
                  formatAddressValue([
                    detail.profile?.address_line,
                    detail.profile?.zip_code,
                    detail.profile?.city,
                    detail.profile?.province,
                  ]) ?? '—'
                }
              />
            ) : null}
            {canManage ? (
              <SummaryBlock
                label="Indirizzo servizi"
                value={
                  formatAddressValue([
                    detail.profile?.dog_address_line,
                    detail.profile?.dog_zip_code,
                    detail.profile?.dog_city,
                    detail.profile?.dog_province,
                  ]) ?? '—'
                }
              />
            ) : null}
            {canManage ? <SummaryBlock label="Codice fiscale" value={detail.profile?.fiscal_code ?? '—'} /> : null}
            {canManage ? <SummaryBlock label="Data di nascita" value={detail.profile?.birth_date ?? '—'} /> : null}
          </div>

          <HighlightBox title="Dati da completare per le prenotazioni" tone="danger">
            {detail.ownerMissing.length
              ? detail.ownerMissing.join(', ')
              : 'Nessun dato obbligatorio mancante.'}
          </HighlightBox>

          <div className="space-y-3">
            <div className="ui-body font-[var(--font-weight-semibold)]">Cani collegati</div>
            {detail.dogs.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {detail.dogs.map((dog) => (
                  <button
                    key={dog.id}
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedDogId(dog.id)}
                  >
                    <div className="ui-panelInset p-3 space-y-1">
                      <div className="ui-body font-[var(--font-weight-semibold)] underline-offset-2 hover:underline">
                        {dog.name}
                      </div>
                      <div className="ui-muted">{dog.breed ?? 'Razza non specificata'}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyCard label="Nessun cane collegato." />
            )}
          </div>

          {canManage ? (
            <div className="space-y-3">
              <div className="ui-body font-[var(--font-weight-semibold)]">Prenotazioni attive</div>
              {detail.activeTimeline.length ? (
                <div className="space-y-3">
                  {detail.activeTimeline.map((item) => (
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
                <EmptyCard label="Nessuna prenotazione attiva." />
              )}
            </div>
          ) : null}

          <DogDetailModal
            key={selectedDogId ?? 'user-dog-detail-empty'}
            dogId={selectedDogId}
            open={Boolean(selectedDogId)}
            onClose={() => setSelectedDogId(null)}
            canManage={canManage}
          />
          <BookingDetailModal
            key={selectedBooking ? `${selectedBooking.kind}-${selectedBooking.id}` : 'user-booking-detail-empty'}
            item={selectedBooking}
            open={Boolean(selectedBooking)}
            onClose={() => setSelectedBooking(null)}
            canManage={canManage}
            onDeleted={() => {
              setSelectedBooking(null);
              setReloadKey((value) => value + 1);
            }}
          />
        </>
      ) : null}
    </ModalFrame>
  );
}

export function DogDetailModal({
  dogId,
  open,
  onClose,
  onOpenOwner,
  canManage = false,
}: {
  dogId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenOwner?: (userId: string) => void;
  canManage?: boolean;
}) {
  const [state, setState] = useState<LoadState>(() => (open && dogId ? 'loading' : 'idle'));
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDogDetail | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminAgendaItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open || !dogId) return;

    const controller = new AbortController();

    fetchAdminJson<AdminDogDetail>(`/api/admin/dogs/${dogId}`, { signal: controller.signal })
      .then((payload) => {
        setDetail(payload);
        setState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(
          humanizeErrorMessage(err, 'Non siamo riusciti a caricare il dettaglio del cane.')
        );
        setState('error');
      });

    return () => controller.abort();
  }, [dogId, open, reloadKey]);

  return (
    <ModalFrame open={open} title={detail?.dog.name ?? 'Dettaglio cane'} onClose={onClose}>
      {state === 'loading' || state === 'idle' ? <LoadingCard label="Caricamento cane..." /> : null}
      {state === 'error' ? <ErrorCard error={error ?? 'Errore dettaglio cane.'} /> : null}
      {state === 'ready' && detail ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryBlock label="Razza" value={detail.dog.breed ?? '—'} />
            <SummaryBlock label="Taglia" value={detail.dog.size_category ?? '—'} />
            <SummaryBlock label="Microchip" value={detail.dog.microchip ?? '—'} />
            <SummaryBlock
              label="Proprietario"
              value={
                onOpenOwner ? (
                  <button type="button" className="underline underline-offset-2" onClick={() => onOpenOwner(detail.dog.owner_id)}>
                    {detail.owner?.first_name || detail.owner?.last_name
                      ? `${detail.owner?.first_name ?? ''} ${detail.owner?.last_name ?? ''}`.trim()
                      : 'Cliente'}
                  </button>
                ) : detail.owner?.first_name || detail.owner?.last_name ? (
                  `${detail.owner?.first_name ?? ''} ${detail.owner?.last_name ?? ''}`.trim()
                ) : (
                  'Cliente'
                )
              }
            />
          </div>

          {detail.dog.notes ? <SummaryBlock label="Note" value={detail.dog.notes} /> : null}

          <div className="space-y-3">
            <div className="ui-body font-[var(--font-weight-semibold)]">Prenotazioni attive</div>
            {detail.activeTimeline.length ? (
              <div className="space-y-3">
                {detail.activeTimeline.map((item) => (
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
              <EmptyCard label="Nessuna prenotazione attiva." />
            )}
          </div>

          <BookingDetailModal
            key={selectedBooking ? `${selectedBooking.kind}-${selectedBooking.id}` : 'dog-booking-detail-empty'}
            item={selectedBooking}
            open={Boolean(selectedBooking)}
            onClose={() => setSelectedBooking(null)}
            canManage={canManage}
            onDeleted={() => {
              setSelectedBooking(null);
              setReloadKey((value) => value + 1);
            }}
          />
        </>
      ) : null}
    </ModalFrame>
  );
}

export function BookingDetailModal({
  item,
  open,
  onClose,
  canManage = false,
  onDeleted,
}: {
  item: AdminAgendaItem | null;
  open: boolean;
  onClose: () => void;
  canManage?: boolean;
  onDeleted?: () => void;
}) {
  const [state, setState] = useState<LoadState>(() => (open && item ? 'loading' : 'idle'));
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminBookingDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const confirm = useConfirm();

  const handleDelete = async () => {
    if (!item) return;
    const ok = await confirm({
      keyword: 'ELIMINA',
      title: 'Elimina prenotazione',
      message: 'L’operazione storna saldo/crediti e non è reversibile.',
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const kind = item.kind === 'SERVICE_SLOT' ? 'service-slot' : 'pensione';
      await fetchAdminJson(`/api/admin/bookings/${kind}/${item.id}`, { method: 'DELETE' });
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a eliminare la prenotazione.'));
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!open || !item) return;

    const controller = new AbortController();

    const kind = item.kind === 'SERVICE_SLOT' ? 'service-slot' : 'pensione';
    fetchAdminJson<AdminBookingDetail>(`/api/admin/bookings/${kind}/${item.id}`, {
      signal: controller.signal,
    })
      .then((payload) => {
        setDetail(payload);
        setState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(
          humanizeErrorMessage(err, 'Non siamo riusciti a caricare il dettaglio della prenotazione.')
        );
        setState('error');
      });

    return () => controller.abort();
  }, [item, open, reloadKey]);

  return (
    <ModalFrame
      open={open}
      title={item?.serviceLabel ?? 'Dettaglio servizio'}
      onClose={onClose}
      maxWidthClassName="sm:max-w-5xl"
    >
      {state === 'loading' || state === 'idle' ? <LoadingCard label="Caricamento servizio..." /> : null}
      {state === 'error' ? <ErrorCard error={error ?? 'Errore dettaglio servizio.'} /> : null}
      {state === 'ready' && detail
        ? (() => {
            const ownerMissing = detail.kind === 'PENSIONE' ? buildRequiredOwnerMissing(detail.user.profile) : [];

            return (
              <>
                <Card>
                  <CardContent className="space-y-4">
                    <SectionHeader
                      title="Dettaglio prenotazione"
                      subtitle="Informazioni operative, economiche e logistiche del servizio."
                    />

                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="ui-btnCompact"
                          onClick={async () => {
                            const ok = await confirm({
                              keyword: 'MODIFICA',
                              title: 'Modifica prenotazione',
                              message: 'Stai per modificare una prenotazione. Le variazioni possono incidere sul saldo del cliente.',
                            });
                            if (ok) setEditOpen(true);
                          }}
                        >
                          Modifica
                        </Button>
                        {detail.kind === 'PENSIONE' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="ui-btnCompact"
                            onClick={() => window.open(`/admin/print/pensione/${detail.id}`, '_blank', 'noopener')}
                          >
                            Stampa
                          </Button>
                        ) : null}
                        {onDeleted ? (
                          <Button
                            type="button"
                            variant="danger"
                            className="ui-btnCompact"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                          >
                            {deleting ? 'Eliminazione…' : 'Elimina prenotazione'}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    {detail.kind === 'PENSIONE' && detail.printedAt ? (
                      <div className="flex flex-wrap gap-2">
                        <span className="ui-accentPill">Stampata il {formatDateTime(detail.printedAt)}</span>
                      </div>
                    ) : null}

                    {error ? <div className="ui-error">{error}</div> : null}

                    {detail.meta.length ? (
                      <div className="flex flex-wrap gap-2">
                        {detail.meta.map((meta) => (
                          <span key={meta} className="ui-accentPill">
                            {meta}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <DetailSection
                      title="Operatività"
                      items={[
                        { label: 'Servizio', value: detail.serviceLabel },
                        { label: 'Stato', value: <StatusBadge status={detail.status} /> },
                        { label: 'Cliente', value: detail.user.fullName },
                        { label: 'Cani collegati', value: detail.dogs.length },
                        { label: 'Dal', value: formatDateTime(detail.startAt) },
                        { label: 'Al', value: detail.endAt ? formatDateTime(detail.endAt) : null },
                        {
                          label: 'Creata il',
                          value: detail.booking.createdAt ? formatDateTime(detail.booking.createdAt) : null,
                        },
                        { label: 'Arrivo previsto', value: formatTimeOnly(detail.booking.arrivalTime) },
                        { label: 'Partenza prevista', value: formatTimeOnly(detail.booking.departureTime) },
                      ]}
                    />

                    <DetailSection
                      title="Costi e crediti"
                      items={[
                        {
                          label: 'Totale prenotazione',
                          value: detail.totalPrice !== null ? formatEuro(detail.totalPrice) : null,
                        },
                        {
                          label: 'Prezzo taxi',
                          value: detail.taxi.priceEur !== null ? formatEuro(detail.taxi.priceEur) : null,
                        },
                        {
                          label: 'Crediti scalati',
                          value: detail.credits.creditsSpent !== null ? detail.credits.creditsSpent : null,
                        },
                        { label: 'Pass utilizzato', value: detail.credits.passId ?? null },
                      ]}
                    />

                    {detail.taxi.enabled || detail.user.phone || detail.user.dogAddressLine ? (
                      <DetailSection
                        title="Taxi dog"
                        items={[
                          { label: 'Taxi', value: detail.taxi.enabled ? 'Attivo' : 'Non richiesto' },
                          { label: 'Modalità taxi', value: formatTaxiOptionLabel(detail.taxi.option) },
                          {
                            label: 'Fascia distanza',
                            value: formatTaxiDistanceBandLabel(detail.booking.taxiDistanceBand),
                          },
                          {
                            label: 'Distanza stimata',
                            value: detail.taxi.distanceKm !== null ? `${detail.taxi.distanceKm} km` : null,
                          },
                          { label: 'Ritiro taxi', value: formatTimeOnly(detail.booking.taxiPickupTime) },
                          { label: 'Ritorno taxi', value: formatTimeOnly(detail.booking.taxiReturnTime) },
                          { label: 'Telefono contatto', value: detail.user.phone ?? null },
                          {
                            label: 'Indirizzo servizio',
                            value: formatAddressValue([
                              detail.user.dogAddressLine,
                              detail.user.dogZipCode,
                              detail.user.dogCity,
                              detail.user.dogProvince,
                            ]),
                          },
                        ]}
                      />
                    ) : null}

                    {detail.notes ? <HighlightBox title="Note prenotazione">{detail.notes}</HighlightBox> : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4">
                    <SectionHeader title={detail.dogs.length === 1 ? 'Dettaglio cane' : 'Dettaglio cani'} />
                    {detail.dogs.length ? (
                      <div className="space-y-3">
                        {detail.dogs.map((dog) => {
                          const requiredDogMissing = detail.kind === 'PENSIONE' ? buildRequiredDogMissing(dog) : [];

                          return (
                            <Card key={dog.dogId} className="admin-listCard">
                              <CardContent className="space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="ui-body font-[var(--font-weight-semibold)]">{dog.name}</div>
                                    {dog.breed ? <div className="ui-muted">{dog.breed}</div> : null}
                                    {dog.infoLocked ? (
                                      <span className="ui-accentPill mt-1 inline-block">✓ Info verificate</span>
                                    ) : null}
                                  </div>
                                  {dog.pricing.total !== null ? (
                                    <span className="ui-accentPill">{formatEuro(dog.pricing.total)}</span>
                                  ) : null}
                                </div>

                                <MissingAlert
                                  title="Informazioni cane mancanti per la pensione"
                                  items={requiredDogMissing}
                                />

                                <DetailSection
                                  title="Profilo cane"
                                  items={[
                                    { label: 'Razza', value: dog.breed ?? null },
                                    { label: 'Taglia', value: dog.sizeCategory ?? null },
                                    { label: 'Sesso', value: formatDogSexLabel(dog.sex) },
                                    { label: 'Microchip', value: dog.microchip ?? null },
                                    {
                                      label: 'Data di nascita',
                                      value: dog.birthDate ? formatDateTime(dog.birthDate) : null,
                                    },
                                    {
                                      label: 'Difficoltà toelettatura',
                                      value: formatGroomingDifficultyLabel(dog.groomingDifficulty),
                                    },
                                    { label: 'Colore mantello', value: dog.coatColor ?? null },
                                    {
                                      label: 'Temperamento',
                                      value: dog.temperament?.length ? dog.temperament.join(', ') : null,
                                    },
                                  ]}
                                />

                                <DetailSection
                                  title="Alloggio e costi"
                                  items={[
                                    {
                                      label: 'Alloggio',
                                      value: formatAccommodationTypeLabel(dog.pricing.accommodationType),
                                    },
                                    {
                                      label: 'Prezzo alloggio / giorno',
                                      value:
                                        dog.pricing.accommodationPricePerDay !== null
                                          ? formatEuro(dog.pricing.accommodationPricePerDay)
                                          : null,
                                    },
                                    {
                                      label: 'Giorni conteggiati',
                                      value: dog.pricing.daysCount !== null ? dog.pricing.daysCount : null,
                                    },
                                    {
                                      label: 'Subtotale alloggio',
                                      value:
                                        dog.pricing.accommodationSubtotal !== null
                                          ? formatEuro(dog.pricing.accommodationSubtotal)
                                          : null,
                                    },
                                    {
                                      label: 'Subtotale extra',
                                      value:
                                        dog.pricing.extrasSubtotal !== null
                                          ? formatEuro(dog.pricing.extrasSubtotal)
                                          : null,
                                    },
                                    {
                                      label: 'Totale cane',
                                      value: dog.pricing.total !== null ? formatEuro(dog.pricing.total) : null,
                                    },
                                  ]}
                                />

                                {detail.kind === 'PENSIONE' ? (
                                  <DetailSection
                                    title="Voci di costo"
                                    items={[
                                      ...buildDogCostLines({
                                        accommodationType: dog.pricing.accommodationType as AccommodationKey | null,
                                        accommodationPricePerDay: dog.pricing.accommodationPricePerDay,
                                        accommodationSubtotal: dog.pricing.accommodationSubtotal,
                                        daysCount: dog.pricing.daysCount,
                                        extras: dog.extras,
                                        sizeCategory: dog.sizeCategory,
                                        groomingDifficulty: dog.groomingDifficulty,
                                      }).map((line) => ({ label: line.label, value: formatEuro(line.amount) })),
                                      {
                                        label: 'Totale cane',
                                        value: dog.pricing.total !== null ? formatEuro(dog.pricing.total) : null,
                                      },
                                    ]}
                                  />
                                ) : null}

                                {dog.extras?.grooming ? (
                                  <HighlightBox title="Toelettatura">Toelettatura richiesta per questo cane.</HighlightBox>
                                ) : null}

                                {dog.extras?.therapyActive ? (
                                  <HighlightBox title="Terapia" tone="danger">
                                    {dog.extras.therapyNotes?.trim()
                                      ? dog.extras.therapyNotes
                                      : 'Terapia attiva segnalata, ma senza dettagli compilati.'}
                                  </HighlightBox>
                                ) : null}

                                <DetailSection
                                  title="Extra prenotati"
                                  items={[
                                    { label: 'Vaccinazione', value: dog.extras?.vaccine ? 'Richiesta' : null },
                                    {
                                      label: 'Ricerca olfattiva',
                                      value:
                                        (dog.extras?.trackingSessions ?? 0) > 0
                                          ? `${dog.extras?.trackingSessions} sessioni`
                                          : null,
                                    },
                                    {
                                      label: 'Fitness',
                                      value:
                                        (dog.extras?.fitnessSessions ?? 0) > 0
                                          ? `${dog.extras?.fitnessSessions} sessioni`
                                          : null,
                                    },
                                    {
                                      label: 'Passeggiate',
                                      value:
                                        (dog.extras?.walkSessions ?? 0) > 0
                                          ? `${dog.extras?.walkSessions} uscite`
                                          : null,
                                    },
                                    {
                                      label: 'Trekking',
                                      value:
                                        (dog.extras?.trekkingSessions ?? 0) > 0
                                          ? `${dog.extras?.trekkingSessions} sessioni`
                                          : null,
                                    },
                                  ]}
                                />

                                {dog.notes ? <HighlightBox title="Note cane">{dog.notes}</HighlightBox> : null}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyCard label="Nessun cane associato." />
                    )}
                  </CardContent>
                </Card>

                {detail.user.profile ? (
                  <Card>
                    <CardContent className="space-y-4">
                      <SectionHeader title="Dettaglio proprietario" />

                      <MissingAlert
                        title="Informazioni proprietario mancanti per la prenotazione"
                        items={ownerMissing}
                      />

                      <DetailSection
                        title="Anagrafica"
                        items={[
                          { label: 'Nome', value: detail.user.profile.first_name ?? null },
                          { label: 'Cognome', value: detail.user.profile.last_name ?? null },
                          {
                            label: 'Data di nascita',
                            value: detail.user.profile.birth_date
                              ? formatDateTime(detail.user.profile.birth_date)
                              : null,
                          },
                          { label: 'Codice fiscale', value: detail.user.profile.fiscal_code ?? null },
                        ]}
                      />

                      <DetailSection
                        title="Contatti"
                        items={[
                          { label: 'Telefono', value: detail.user.profile.phone ?? null },
                          { label: 'Email', value: detail.user.profile.email ?? null },
                        ]}
                      />

                      <DetailSection
                        title="Indirizzi"
                        items={[
                          {
                            label: 'Residenza',
                            value: formatAddressValue([
                              detail.user.profile.address_line,
                              detail.user.profile.zip_code,
                              detail.user.profile.city,
                              detail.user.profile.province,
                            ]),
                          },
                          {
                            label: 'Indirizzo servizi',
                            value: formatAddressValue([
                              detail.user.profile.dog_address_line,
                              detail.user.profile.dog_zip_code,
                              detail.user.profile.dog_city,
                              detail.user.profile.dog_province,
                            ]),
                          },
                        ]}
                      />

                      <DetailSection
                        title="Documenti"
                        items={[
                          {
                            label: 'Documento di identità (fronte)',
                            value: detail.user.profile.id_document_path
                              ? detail.user.profile.id_document_uploaded_at
                                ? `Caricato il ${formatDateTime(detail.user.profile.id_document_uploaded_at)}`
                                : 'Caricato'
                              : null,
                          },
                          {
                            label: 'Documento di identità (retro)',
                            value: detail.user.profile.id_document_back_path
                              ? detail.user.profile.id_document_back_uploaded_at
                                ? `Caricato il ${formatDateTime(detail.user.profile.id_document_back_uploaded_at)}`
                                : 'Caricato'
                              : null,
                          },
                        ]}
                        columns={1}
                      />
                    </CardContent>
                  </Card>
                ) : null}

                <BookingEditModal
                  item={item}
                  open={editOpen}
                  onClose={() => setEditOpen(false)}
                  onSaved={() => {
                    setReloadKey((key) => key + 1);
                    onDeleted?.();
                  }}
                />
              </>
            );
          })()
        : null}
    </ModalFrame>
  );
}
