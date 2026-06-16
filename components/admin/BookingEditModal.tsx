'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Card, CardContent } from '@/components/ui/Card';
import { ModalFrame, LoadingCard, ErrorCard, formatEuro } from '@/components/admin/shared';
import type { AdminAgendaItem, AdminBookingDetail, AdminSlotRecord, AdminUserDetail } from '@/lib/admin/types';
import { ACCOMMODATION_PRICES } from '@/lib/services/pensione/constants';
import { computePricing } from '@/lib/services/pensione/utils';
import type { DogLite, PerDogForm } from '@/lib/services/pensione/types';
import type { AccommodationKey, TaxiDistanceBand, TaxiOption } from '@/types/booking';

const ACCOMMODATION_OPTIONS = Object.entries(ACCOMMODATION_PRICES).map(([key, value]) => ({
  key: key as AccommodationKey,
  label: value.label,
}));

const TAXI_OPTIONS: Array<{ value: TaxiOption; label: string }> = [
  { value: 'NONE', label: 'Nessun taxi' },
  { value: 'ONE_WAY', label: 'Solo andata' },
  { value: 'RETURN_ONLY', label: 'Solo ritorno' },
  { value: 'ROUND_TRIP', label: 'Andata e ritorno' },
];

function emptyPerDog(): PerDogForm {
  return {
    accommodationType: 'BOX',
    grooming: false,
    vaccine: false,
    trackingSessions: 0,
    fitnessSessions: 0,
    walkSessions: 0,
    trekkingSessions: 0,
    therapy: 'NO',
    therapyNotes: '',
  };
}

function perDogFromDetailDog(dog: AdminBookingDetail['dogs'][number]): PerDogForm {
  const extras = dog.extras;
  return {
    accommodationType: (dog.pricing.accommodationType as AccommodationKey) ?? 'BOX',
    grooming: Boolean(extras?.grooming),
    vaccine: Boolean(extras?.vaccine),
    trackingSessions: extras?.trackingSessions ?? 0,
    fitnessSessions: extras?.fitnessSessions ?? 0,
    walkSessions: extras?.walkSessions ?? 0,
    trekkingSessions: extras?.trekkingSessions ?? 0,
    therapy: extras?.therapyActive ? 'YES' : 'NO',
    therapyNotes: extras?.therapyNotes ?? '',
  };
}

function dateOf(value: string | null | undefined): string {
  return String(value ?? '').slice(0, 10);
}

function timeOf(value: string | null | undefined, fallback = '10:00'): string {
  const match = String(value ?? '').match(/(\d{2}:\d{2})/);
  return match?.[1] ?? fallback;
}

export function BookingEditModal({
  item,
  open,
  onClose,
  onSaved,
}: {
  item: AdminAgendaItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const kind = item?.kind ?? 'PENSIONE';
  const kindPath = kind === 'SERVICE_SLOT' ? 'service-slot' : 'pensione';

  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminBookingDetail | null>(null);
  const [ownerDogs, setOwnerDogs] = useState<AdminUserDetail['dogs']>([]);
  const [slots, setSlots] = useState<AdminSlotRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Pensione form
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('10:00');
  const [departureTime, setDepartureTime] = useState('10:00');
  const [taxiOption, setTaxiOption] = useState<TaxiOption>('NONE');
  const [taxiDistanceBand, setTaxiDistanceBand] = useState<TaxiDistanceBand>('ENTRO_40');
  const [notes, setNotes] = useState('');
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);
  const [perDogForm, setPerDogForm] = useState<Record<string, PerDogForm>>({});

  // Slot form
  const [slotId, setSlotId] = useState<string>('');
  const [slotDogId, setSlotDogId] = useState<string>('');
  const [slotTaxiEnabled, setSlotTaxiEnabled] = useState(false);
  const [slotTaxiPrice, setSlotTaxiPrice] = useState('');
  const [slotTaxiKm, setSlotTaxiKm] = useState('');

  useEffect(() => {
    if (!open || !item) return;
    const controller = new AbortController();
    setState('loading');
    setError(null);

    (async () => {
      try {
        const bookingDetail = await fetchAdminJson<AdminBookingDetail>(
          `/api/admin/bookings/${kindPath}/${item.id}`,
          { signal: controller.signal }
        );
        const userDetail = await fetchAdminJson<AdminUserDetail>(
          `/api/admin/users/${bookingDetail.user.userId}`,
          { signal: controller.signal }
        );

        setDetail(bookingDetail);
        setOwnerDogs(userDetail.dogs);

        if (bookingDetail.kind === 'PENSIONE') {
          setStartDate(dateOf(bookingDetail.startAt));
          setEndDate(dateOf(bookingDetail.endAt ?? bookingDetail.startAt));
          setArrivalTime(timeOf(bookingDetail.booking.arrivalTime ?? bookingDetail.startAt));
          setDepartureTime(timeOf(bookingDetail.booking.departureTime ?? bookingDetail.endAt));
          setTaxiOption(bookingDetail.taxi.option ?? 'NONE');
          setTaxiDistanceBand(bookingDetail.booking.taxiDistanceBand ?? 'ENTRO_40');
          setNotes(bookingDetail.notes ?? '');
          const ids = bookingDetail.dogs.map((dog) => dog.dogId);
          setSelectedDogIds(ids);
          setPerDogForm(
            Object.fromEntries(bookingDetail.dogs.map((dog) => [dog.dogId, perDogFromDetailDog(dog)]))
          );
        } else {
          setSlotDogId(bookingDetail.dogs[0]?.dogId ?? '');
          setSlotTaxiEnabled(bookingDetail.taxi.enabled);
          setSlotTaxiPrice(bookingDetail.taxi.priceEur != null ? String(bookingDetail.taxi.priceEur) : '');
          setSlotTaxiKm(bookingDetail.taxi.distanceKm != null ? String(bookingDetail.taxi.distanceKm) : '');
          setNotes(bookingDetail.notes ?? '');

          const start = new Date().toISOString().slice(0, 10);
          const end = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const serviceParam = bookingDetail.serviceType ?? 'CONSULENZA';
          const view = await fetchAdminJson<{ slots: AdminSlotRecord[] }>(
            `/api/admin/services?services=${serviceParam}&start=${start}&end=${end}`,
            { signal: controller.signal }
          );
          const sameType = view.slots.filter((slot) => slot.serviceType === bookingDetail.serviceType);
          setSlots(sameType);
          setSlotId('');
        }

        setState('ready');
      } catch (err) {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare la prenotazione.'));
        setState('error');
      }
    })();

    return () => controller.abort();
  }, [open, item, kindPath]);

  const ownerDogLites = useMemo<DogLite[]>(
    () =>
      ownerDogs.map((dog) => ({
        id: dog.id,
        name: dog.name,
        photo_path: null,
        updated_at: null,
        size_category: dog.size_category ?? null,
        grooming_difficulty: dog.grooming_difficulty ?? null,
      })),
    [ownerDogs]
  );

  const livePricing = useMemo(() => {
    if (!detail || detail.kind !== 'PENSIONE' || selectedDogIds.length === 0) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
    const msPerDay = 24 * 60 * 60 * 1000;
    let daysCount = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
    const hour = parseInt(departureTime.split(':')[0] ?? '0', 10);
    if (hour >= 9 && hour < 13) daysCount = Math.max(daysCount - 1, 1);
    return computePricing({
      selectedDogIds,
      daysCount,
      dogs: ownerDogLites,
      perDogForm,
      taxiOption,
      taxiDistanceBand,
    });
  }, [detail, selectedDogIds, startDate, endDate, departureTime, ownerDogLites, perDogForm, taxiOption, taxiDistanceBand]);

  const updatesBalance =
    detail?.status === 'CONFIRMED' || detail?.status === 'COMPLETED';
  const currentTotal = detail?.totalPrice ?? 0;
  const delta = livePricing ? livePricing.totalPrice - currentTotal : 0;

  const toggleDog = (dogId: string) => {
    setSelectedDogIds((current) => {
      if (current.includes(dogId)) return current.filter((id) => id !== dogId);
      setPerDogForm((forms) => (forms[dogId] ? forms : { ...forms, [dogId]: emptyPerDog() }));
      return [...current, dogId];
    });
  };

  const setDogForm = (dogId: string, patch: Partial<PerDogForm>) =>
    setPerDogForm((current) => ({ ...current, [dogId]: { ...(current[dogId] ?? emptyPerDog()), ...patch } }));

  const handleSubmitPensione = async () => {
    if (!detail) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchAdminJson(`/api/admin/bookings/pensione/${detail.id}/full`, {
        method: 'PATCH',
        body: JSON.stringify({
          startDate,
          endDate,
          arrivalTime,
          departureTime,
          notes,
          taxiOption,
          taxiDistanceBand,
          selectedDogIds,
          perDogForm,
        }),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare la prenotazione.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSlot = async () => {
    if (!detail) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchAdminJson(`/api/admin/bookings/service-slot/${detail.id}/full`, {
        method: 'PATCH',
        body: JSON.stringify({
          slotId: slotId || null,
          dogId: slotDogId || null,
          taxiEnabled: slotTaxiEnabled,
          taxiDistanceKm: slotTaxiKm ? Number(slotTaxiKm) : null,
          taxiPriceEur: slotTaxiEnabled && slotTaxiPrice ? Number(slotTaxiPrice) : null,
          notes,
        }),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare la prenotazione.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalFrame
      open={open}
      title={`Modifica ${item?.serviceLabel ?? 'prenotazione'}`}
      onClose={onClose}
      maxWidthClassName="sm:max-w-3xl"
    >
      {state === 'loading' || state === 'idle' ? <LoadingCard label="Caricamento prenotazione..." /> : null}
      {state === 'error' ? <ErrorCard error={error ?? 'Errore.'} /> : null}

      {state === 'ready' && detail && detail.kind === 'PENSIONE' ? (
        <div className="space-y-4">
          {error ? <div className="ui-error">{error}</div> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Arrivo">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="ui-control ui-input" />
            </Field>
            <Field label="Partenza">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="ui-control ui-input" />
            </Field>
            <Field label="Orario arrivo">
              <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} className="ui-control ui-input" />
            </Field>
            <Field label="Orario partenza">
              <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className="ui-control ui-input" />
            </Field>
            <Field label="Taxi">
              <select value={taxiOption} onChange={(e) => setTaxiOption(e.target.value as TaxiOption)} className="ui-control ui-select">
                {TAXI_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            {taxiOption !== 'NONE' ? (
              <Field label="Fascia distanza">
                <select value={taxiDistanceBand} onChange={(e) => setTaxiDistanceBand(e.target.value as TaxiDistanceBand)} className="ui-control ui-select">
                  <option value="ENTRO_40">Entro 40 km</option>
                  <option value="OLTRE_40">Oltre 40 km</option>
                </select>
              </Field>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="ui-body font-[var(--font-weight-semibold)]">Cani</div>
            <div className="flex flex-wrap gap-2">
              {ownerDogs.map((dog) => (
                <button
                  key={dog.id}
                  type="button"
                  onClick={() => toggleDog(dog.id)}
                  className={['rounded-full px-4 py-2 ui-body ui-clickable', selectedDogIds.includes(dog.id) ? 'ui-clickable--selected' : ''].join(' ')}
                >
                  {dog.name}
                </button>
              ))}
            </div>
          </div>

          {selectedDogIds.map((dogId) => {
            const dog = ownerDogs.find((d) => d.id === dogId);
            const form = perDogForm[dogId] ?? emptyPerDog();
            return (
              <Card key={dogId} className="admin-listCard">
                <CardContent className="space-y-3">
                  <div className="ui-body font-[var(--font-weight-semibold)]">{dog?.name ?? 'Cane'}</div>
                  <Field label="Alloggio">
                    <select
                      value={form.accommodationType}
                      onChange={(e) => setDogForm(dogId, { accommodationType: e.target.value as AccommodationKey })}
                      className="ui-control ui-select"
                    >
                      {ACCOMMODATION_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 ui-body">
                      <input type="checkbox" checked={form.grooming} onChange={(e) => setDogForm(dogId, { grooming: e.target.checked })} />
                      Toelettatura
                    </label>
                    <label className="flex items-center gap-2 ui-body">
                      <input type="checkbox" checked={form.vaccine} onChange={(e) => setDogForm(dogId, { vaccine: e.target.checked })} />
                      Vaccinazione
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Field label="Ricerca olfattiva">
                      <input type="number" min="0" value={form.trackingSessions} onChange={(e) => setDogForm(dogId, { trackingSessions: Math.max(0, Number(e.target.value) || 0) })} className="ui-control ui-input" />
                    </Field>
                    <Field label="Fitness">
                      <input type="number" min="0" value={form.fitnessSessions} onChange={(e) => setDogForm(dogId, { fitnessSessions: Math.max(0, Number(e.target.value) || 0) })} className="ui-control ui-input" />
                    </Field>
                    <Field label="Passeggiate">
                      <input type="number" min="0" value={form.walkSessions} onChange={(e) => setDogForm(dogId, { walkSessions: Math.max(0, Number(e.target.value) || 0) })} className="ui-control ui-input" />
                    </Field>
                    <Field label="Trekking">
                      <input type="number" min="0" value={form.trekkingSessions} onChange={(e) => setDogForm(dogId, { trekkingSessions: Math.max(0, Number(e.target.value) || 0) })} className="ui-control ui-input" />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 ui-body">
                    <input
                      type="checkbox"
                      checked={form.therapy === 'YES'}
                      onChange={(e) => setDogForm(dogId, { therapy: e.target.checked ? 'YES' : 'NO' })}
                    />
                    Terapia
                  </label>
                  {form.therapy === 'YES' ? (
                    <Field label="Note terapia">
                      <textarea value={form.therapyNotes} onChange={(e) => setDogForm(dogId, { therapyNotes: e.target.value })} className="ui-control ui-textarea" rows={2} />
                    </Field>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}

          <Field label="Note prenotazione">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="ui-control ui-textarea" rows={3} />
          </Field>

          <div className="ui-panelInset p-4 space-y-1">
            <div className="ui-body">Totale attuale: <span className="font-[var(--font-weight-semibold)]">{formatEuro(currentTotal)}</span></div>
            <div className="ui-body">Nuovo totale: <span className="font-[var(--font-weight-semibold)]">{livePricing ? formatEuro(livePricing.totalPrice) : '—'}</span></div>
            {updatesBalance ? (
              <div className="ui-body">
                Variazione saldo: <span className="font-[var(--font-weight-bold)]">{delta >= 0 ? '+' : ''}{formatEuro(delta)}</span>
              </div>
            ) : (
              <div className="ui-muted">La prenotazione non è a saldo: il totale cambia ma il saldo non viene toccato.</div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Annulla</Button>
            <Button type="button" variant="primary" onClick={() => void handleSubmitPensione()} disabled={submitting || selectedDogIds.length === 0}>
              {submitting ? 'Salvataggio…' : 'Salva modifiche'}
            </Button>
          </div>
        </div>
      ) : null}

      {state === 'ready' && detail && detail.kind === 'SERVICE_SLOT' ? (
        <div className="space-y-4">
          {error ? <div className="ui-error">{error}</div> : null}

          <Field label="Slot" hint="Lascia invariato per non spostare la prenotazione.">
            <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className="ui-control ui-select">
              <option value="">— Slot attuale —</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id} disabled={slot.remainingCount <= 0}>
                  {new Date(slot.startAt).toLocaleString('it-IT')} · {slot.remainingCount} liberi
                </option>
              ))}
            </select>
          </Field>

          {ownerDogs.length > 0 ? (
            <Field label="Cane">
              <select value={slotDogId} onChange={(e) => setSlotDogId(e.target.value)} className="ui-control ui-select">
                <option value="">—</option>
                {ownerDogs.map((dog) => (
                  <option key={dog.id} value={dog.id}>{dog.name}</option>
                ))}
              </select>
            </Field>
          ) : null}

          <label className="flex items-center gap-2 ui-body">
            <input type="checkbox" checked={slotTaxiEnabled} onChange={(e) => setSlotTaxiEnabled(e.target.checked)} />
            Taxi dog
          </label>
          {slotTaxiEnabled ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Distanza (km)">
                <input type="number" min="0" value={slotTaxiKm} onChange={(e) => setSlotTaxiKm(e.target.value)} className="ui-control ui-input" />
              </Field>
              <Field label="Prezzo taxi (€)">
                <input type="number" min="0" step="0.01" value={slotTaxiPrice} onChange={(e) => setSlotTaxiPrice(e.target.value)} className="ui-control ui-input" />
              </Field>
            </div>
          ) : null}

          <Field label="Note prenotazione">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="ui-control ui-textarea" rows={3} />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Annulla</Button>
            <Button type="button" variant="primary" onClick={() => void handleSubmitSlot()} disabled={submitting}>
              {submitting ? 'Salvataggio…' : 'Salva modifiche'}
            </Button>
          </div>
        </div>
      ) : null}
    </ModalFrame>
  );
}
