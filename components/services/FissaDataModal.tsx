// FILE: components/services/FissaDataModal.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Modal } from '@/components/common/Modal';
import { SlotMonthPicker } from '@/components/services/calendar/SlotMonthPicker';

import type { ServicePassGroupSummary } from '@/types/services';
import { computeTaxiPrice, getServiceLabel, requiresDogs } from '@/types/services';

import {
  getAvailableServiceSlotsInRange,
  bookServiceSlotAtomic,
  type ServiceSlotWithRemainingRow,
} from '@/lib/services/serviceCalendarApi';
import { addToWalletDueEur } from '@/lib/wallet/walletApi';
import { supabase } from '@/lib/supabaseClient';
import { DogAvatar } from '@/components/dogs/DogAvatar';
import { Button } from '@/components/ui/Button';
import { TaxiQuote } from '@/components/services/common/TaxiQuote';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type DogLite = {
  id: string;
  name: string;
  photo_path: string | null;
  updated_at: string | null;
};

type TaxiDistanceState = {
  loading: boolean;
  error: string | null;
  km: number | null;
};

type ProfileAddressRow = {
  dog_address_line?: string | null;
  dog_city?: string | null;
  dog_zip_code?: string | null;
  dog_province?: string | null;
};

type MissingDataProfileRow = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  fiscal_code?: string | null;
  birth_date?: string | null;
  address_line?: string | null;
  city?: string | null;
  zip_code?: string | null;
  province?: string | null;
  id_document_path?: string | null;
};

type DogMicrochipRow = {
  id: string;
  name: string | null;
  microchip: string | null;
};

type TaxiDistanceApiResponse = {
  ok?: boolean;
  error?: string;
  km?: number;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function buildAddressFromProfile(profile: ProfileAddressRow | null): string {
  const line = (profile?.dog_address_line ?? '').trim();
  const city = (profile?.dog_city ?? '').trim();
  const zip = (profile?.dog_zip_code ?? '').trim();
  const prov = (profile?.dog_province ?? '').trim();

  const parts: string[] = [];
  if (line) parts.push(line);

  const cityLine = [zip, city].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);
  if (prov) parts.push(`(${prov})`);

  const address = parts.join(', ').trim();
  if (!address) return '';

  if (!/italia/i.test(address)) return `${address}, Italia`;
  return address;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function startOfNextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}
function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function sameDayKey(iso: string, key: string): boolean {
  return toDayKey(new Date(iso)) === key;
}
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function slotHalfLabel(startAtIso: string): 'Mattina' | 'Pomeriggio' {
  const d = new Date(startAtIso);
  const h = d.getHours();
  return h < 13 ? 'Mattina' : 'Pomeriggio';
}

async function fetchUserDogs(userId: string): Promise<DogLite[]> {
  const { data, error } = await supabase
    .from('dogs')
    .select('id, name, photo_path, updated_at')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DogLite[];
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    photo_path: d.photo_path ?? null,
    updated_at: d.updated_at ?? null,
  }));
}

async function computeMissingDataWarning(args: {
  userId: string;
  needsDogs: boolean;
  selectedDogIds: string[];
}): Promise<string[]> {
  const missing: string[] = [];

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, last_name, email, fiscal_code, birth_date, address_line, city, zip_code, province, id_document_path')
    .eq('user_id', args.userId)
    .maybeSingle();
  const profileRow = (profile ?? null) as MissingDataProfileRow | null;

  if (profileError) {
    console.error(profileError);
    return [];
  }

  const fn = (profileRow?.first_name ?? '').trim();
  const ln = (profileRow?.last_name ?? '').trim();
  const em = (profileRow?.email ?? '').trim();
  const cf = (profileRow?.fiscal_code ?? '').trim();
  const bd = (profileRow?.birth_date ?? '').trim();

  const addrLine = (profileRow?.address_line ?? '').trim();
  const addrCity = (profileRow?.city ?? '').trim();
  const addrZip = (profileRow?.zip_code ?? '').trim();
  const addrProv = (profileRow?.province ?? '').trim();

  const idDoc = (profileRow?.id_document_path ?? '').trim();

  if (!fn) missing.push('Nome');
  if (!ln) missing.push('Cognome');
  if (!em) missing.push('Email');
  if (!cf) missing.push('Codice fiscale');
  if (!bd) missing.push('Data di nascita');
  if (!addrLine || !addrCity || !addrZip || !addrProv) missing.push('Indirizzo (completo)');
  if (!idDoc) missing.push('Documento di identità');

  if (args.needsDogs && args.selectedDogIds.length > 0) {
    const { data: dogs, error: dogsError } = await supabase.from('dogs').select('id, name, microchip').in('id', args.selectedDogIds);

    if (dogsError) {
      console.error(dogsError);
      return missing;
    }

    const dogRows = (dogs ?? []) as DogMicrochipRow[];
    const missingDogs = dogRows
      .filter((d) => !(d.microchip ?? '').trim())
      .map((d) => (d.name ?? '').trim())
      .filter(Boolean);

    if (missingDogs.length > 0) {
      missing.push(`Numero microchip mancante per: ${missingDogs.join(', ')}`);
    }
  }

  return missing;
}

function humanizeBookingError(err: unknown): string {
  const raw = String(err instanceof Error ? err.message : err ?? '').trim();
  if (!raw) return 'Errore durante la prenotazione.';

  const low = raw.toLowerCase();
  if (low.includes('slot esaurito')) return raw;
  if (low.includes('pass non valido')) return raw;
  if (low.includes('crediti insufficienti')) return raw;
  if (low.includes('seleziona almeno un cane')) return raw;

  if (low.includes('duplicate') || low.includes('unique')) {
    return 'Risulta già una prenotazione per questo slot. Scegli un altro giorno/orario.';
  }

  return raw;
}

export function FissaDataModal({
  open,
  onClose,
  userId,
  pass,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  pass: ServicePassGroupSummary | null;
  onBooked: () => void;
}) {
  const router = useRouter();

  const [monthDate, setMonthDate] = useState<Date>(() => new Date());

  const [slotsState, setSlotsState] = useState<LoadState>('idle');
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slots, setSlots] = useState<ServiceSlotWithRemainingRow[]>([]);

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Dogs
  const [dogsState, setDogsState] = useState<LoadState>('idle');
  const [dogsError, setDogsError] = useState<string | null>(null);
  const [dogs, setDogs] = useState<DogLite[]>([]);
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);

  // Taxi
  const [taxiEnabled, setTaxiEnabled] = useState(false);
  const [taxiDistance, setTaxiDistance] = useState<TaxiDistanceState>({ loading: false, error: null, km: null });

  // Booking
  const [bookingState, setBookingState] = useState<LoadState>('idle');
  const [bookingError, setBookingError] = useState<string | null>(null);

  // ✅ Warning interno (no window.confirm)
  const [missingWarn, setMissingWarn] = useState<string[] | null>(null);
  const [forceProceed, setForceProceed] = useState(false);

  const needsDogs = useMemo(() => (pass ? requiresDogs(pass.serviceType) : false), [pass]);

  const taxiAllowed = useMemo(() => {
    if (!pass) return false;
    if (!needsDogs) return false;
    if (pass.serviceType === 'CONSULENZA') return false;
    return true;
  }, [pass, needsDogs]);

  const creditsToSpend = useMemo(() => {
    if (!pass) return 0;
    if (!needsDogs) return 1;
    return Math.max(1, selectedDogIds.length);
  }, [pass, needsDogs, selectedDogIds]);

  const isAsiloFull = useMemo(() => pass?.serviceType === 'ASILO' && pass?.serviceVariant === 'FULL', [pass]);
  const isAsiloHalf = useMemo(() => pass?.serviceType === 'ASILO' && pass?.serviceVariant === 'HALF', [pass]);

  useEffect(() => {
    if (!open) return;

    setSelectedDayKey(null);
    setSelectedSlotId(null);
    setSelectedDogIds([]);

    setTaxiEnabled(false);
    setTaxiDistance({ loading: false, error: null, km: null });

    setBookingState('idle');
    setBookingError(null);

    setMissingWarn(null);
    setForceProceed(false);
  }, [open, pass?.groupKey]);

  useEffect(() => {
    if (!open) return;
    if (!taxiAllowed && taxiEnabled) setTaxiEnabled(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taxiAllowed]);

  useEffect(() => {
    if (!open) return;
    if (!pass) return;

    if (!needsDogs) {
      setDogsState('ready');
      setDogs([]);
      return;
    }

    let cancelled = false;

    async function run() {
      setDogsState('loading');
      setDogsError(null);
      try {
        const list = await fetchUserDogs(userId);
        if (cancelled) return;
        setDogs(list);
        setDogsState('ready');
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setDogsError(getErrorMessage(e, 'Errore caricamento cani.'));
        setDogsState('error');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [open, pass?.groupKey, needsDogs, userId, pass]);

  useEffect(() => {
    if (!open) return;
    if (!pass) return;

    const currentPass = pass;
    let cancelled = false;

    async function run() {
      setSlotsState('loading');
      setSlotsError(null);

      try {
        const start = startOfMonth(monthDate).toISOString();
        const end = startOfNextMonth(monthDate).toISOString();

        const available = await getAvailableServiceSlotsInRange({
          serviceType: currentPass.serviceType,
          serviceVariant: currentPass.serviceVariant ?? null,
          startIso: start,
          endIso: end,
        });

        if (cancelled) return;

        setSlots(available);
        setSlotsState('ready');

        setSelectedDayKey(null);
        setSelectedSlotId(null);
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setSlotsError(getErrorMessage(e, 'Errore caricamento slot.'));
        setSlotsState('error');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [open, pass?.groupKey, monthDate, pass?.serviceType, pass?.serviceVariant, pass]);

  const daySlots = useMemo(() => {
    if (!selectedDayKey) return [];
    return slots
      .filter((s) => sameDayKey(s.start_at, selectedDayKey))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [slots, selectedDayKey]);

  const daySlotsForUi = useMemo(() => {
    if (!isAsiloFull) return daySlots;
    return daySlots.length > 0 ? [daySlots[0]] : [];
  }, [daySlots, isAsiloFull]);

  useEffect(() => {
    if (!open) return;
    if (!isAsiloFull) return;

    if (selectedDayKey && daySlotsForUi.length === 1) {
      setSelectedSlotId(daySlotsForUi[0].id);
    } else {
      setSelectedSlotId(null);
    }
  }, [open, isAsiloFull, selectedDayKey, daySlotsForUi]);

  const selectedSlot = useMemo(() => daySlotsForUi.find((s) => s.id === selectedSlotId) ?? null, [daySlotsForUi, selectedSlotId]);

  useEffect(() => {
    if (!open) return;
    if (!taxiEnabled) return;

    let cancelled = false;

    const run = async () => {
      setTaxiDistance({ loading: true, error: null, km: null });

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('dog_address_line, dog_city, dog_zip_code, dog_province')
        .eq('user_id', userId)
        .maybeSingle();
      const profileRow = (profile ?? null) as ProfileAddressRow | null;

      if (cancelled) return;

      if (error) {
        setTaxiDistance({ loading: false, error: error.message, km: null });
        return;
      }

      const address = buildAddressFromProfile(profileRow);
      if (!address) {
        setTaxiDistance({ loading: false, error: 'Indirizzo ritiro/servizi mancante nel profilo.', km: null });
        return;
      }

      try {
        const res = await fetch('/api/taxi-distance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, address }),
        });

        const json = (await res.json().catch(() => null)) as TaxiDistanceApiResponse | null;

        if (!json?.ok) {
          setTaxiDistance({ loading: false, error: json?.error ?? 'Errore distanza taxi.', km: null });
          return;
        }

        const km = Number(json.km);
        if (!Number.isFinite(km)) {
          setTaxiDistance({ loading: false, error: 'Distanza non valida.', km: null });
          return;
        }

        setTaxiDistance({ loading: false, error: null, km });
      } catch (e) {
        console.error(e);
        setTaxiDistance({ loading: false, error: 'Errore distanza taxi.', km: null });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, taxiEnabled, userId]);

  const taxiComputed = useMemo(() => {
    if (!taxiEnabled) return { price: null as number | null, band: null as string | null };
    if (taxiDistance.km === null || Number.isNaN(taxiDistance.km)) return { price: null, band: null };
    const res = computeTaxiPrice(taxiDistance.km);
    return { price: res.priceEur, band: res.band };
  }, [taxiEnabled, taxiDistance.km]);

  const canConfirm = useMemo(() => {
    if (!pass) return false;
    if (!selectedSlot) return false;

    if (pass.creditsRemaining < creditsToSpend) return false;

    if (needsDogs && selectedDogIds.length === 0) return false;

    if (taxiEnabled) {
      if (!taxiAllowed) return false;
      if (taxiDistance.km === null || taxiComputed.price === null || taxiDistance.loading || !!taxiDistance.error) return false;
    }

    return true;
  }, [
    pass,
    selectedSlot,
    creditsToSpend,
    needsDogs,
    selectedDogIds,
    taxiEnabled,
    taxiAllowed,
    taxiDistance.km,
    taxiDistance.loading,
    taxiDistance.error,
    taxiComputed.price,
  ]);

  async function handleConfirm() {
    if (!pass) return;
    if (!selectedSlot) return;

    // ✅ warning dati mancanti: NO window.confirm (mobile safe)
    if (pass.serviceType !== 'CONSULENZA' && !forceProceed) {
      try {
        const missing = await computeMissingDataWarning({
          userId,
          needsDogs,
          selectedDogIds,
        });

        if (missing.length > 0) {
          setMissingWarn(missing);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    setBookingState('loading');
    setBookingError(null);

    try {
      await bookServiceSlotAtomic({
        userId,
        slotId: selectedSlot.id,
        passId: null,
        serviceType: pass.serviceType,
        serviceVariant: pass.serviceVariant ?? null,
        dogIds: needsDogs ? selectedDogIds : null,
        creditsSpent: creditsToSpend,
        taxiEnabled: taxiEnabled && taxiAllowed,
        taxiDistanceKm: taxiEnabled && taxiAllowed ? taxiDistance.km : null,
        taxiPriceEur: taxiEnabled && taxiAllowed ? taxiComputed.price : null,
        notes: null,
      });

      if (taxiEnabled && taxiAllowed && taxiComputed.price != null && taxiComputed.price > 0) {
        await addToWalletDueEur(userId, taxiComputed.price);
      }

      setBookingState('ready');
      setMissingWarn(null);
      setForceProceed(false);

      onBooked();
      onClose();
    } catch (e) {
      console.error(e);
      setBookingError(humanizeBookingError(e));
      setBookingState('error');
    }
  }

  const title = pass ? `Fissa data — ${getServiceLabel(pass.serviceType, pass.serviceVariant)}` : 'Fissa data';

  return (
    <Modal open={open} title={title} onClose={onClose}>
      {!pass ? (
        <div className="ui-muted">Seleziona un pacchetto prima di fissare una data.</div>
      ) : (
        <div className="space-y-4">
          <div className="ui-card ui-cardContent">
            <div className="ui-body">
              Crediti residui: <span className="font-[var(--font-weight-bold)]">{pass.creditsRemaining}</span>
            </div>
            {pass.passes.length > 1 ? <div className="ui-muted mt-2">{pass.passes.length} acquisti raggruppati (scalati automaticamente).</div> : null}
          </div>

          {slotsState === 'loading' ? (
            <div className="ui-card ui-cardContent ui-muted">Caricamento disponibilità…</div>
          ) : slotsState === 'error' ? (
            <div className="ui-error">{slotsError}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <SlotMonthPicker
                monthDate={monthDate}
                slots={slots}
                selectedDayKey={selectedDayKey}
                onSelectDay={(k) => {
                  setSelectedDayKey(k);
                  if (!isAsiloFull) setSelectedSlotId(null);
                }}
                onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              />

              <div className="ui-card ui-cardContent space-y-3">
                <div className="ui-body font-[var(--font-weight-bold)]">Disponibilità del giorno</div>
                <div className="ui-muted">{selectedDayKey ? selectedDayKey : 'Seleziona un giorno nel calendario.'}</div>

                <div className="space-y-2">
                  {selectedDayKey && daySlotsForUi.length === 0 ? (
                    <div className="ui-muted">Nessuna disponibilità in questo giorno.</div>
                  ) : null}

                  {daySlotsForUi.map((s) => {
                    const checked = s.id === selectedSlotId;

                    const label = isAsiloFull ? 'Giornata intera' : isAsiloHalf ? slotHalfLabel(s.start_at) : `${formatTime(s.start_at)}–${formatTime(s.end_at)}`;

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSlotId(s.id)}
                        className={['ui-selectCard', checked ? 'ui-selectCard--selected' : ''].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-3 ui-minw0">
                          <div className="ui-body font-[var(--font-weight-bold)]">{label}</div>
                          <div className="ui-muted">
                            Rimasti: <span className="font-[var(--font-weight-bold)]">{s.remaining_capacity ?? '—'}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {needsDogs ? (
                  <div className="pt-2">
                    <div className="ui-body font-[var(--font-weight-bold)]">Seleziona cane/i</div>

                    {dogsState === 'loading' ? (
                      <div className="ui-muted mt-2">Caricamento cani…</div>
                    ) : dogsState === 'error' ? (
                      <div className="ui-error mt-2">{dogsError}</div>
                    ) : dogs.length === 0 ? (
                      <div className="ui-muted mt-2">Nessun cane disponibile. Creane uno prima.</div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {dogs.map((d) => {
                          const selected = selectedDogIds.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() =>
                                setSelectedDogIds((prev) => (selected ? prev.filter((x) => x !== d.id) : [...prev, d.id]))
                              }
                              className={['ui-selectCard', selected ? 'ui-selectCard--selected' : ''].join(' ')}
                            >
                              <div className="flex items-center justify-between gap-3 ui-minw0">
                                <div className="flex items-center gap-3 ui-minw0">
                                  <DogAvatar photoPath={d.photo_path} updatedAt={d.updated_at} alt={d.name} size={28} />
                                  <div className="ui-body font-[var(--font-weight-bold)] truncate">{d.name}</div>
                                </div>
                                <div className={['ui-pill', selected ? 'ui-pill--selected' : ''].join(' ')}>
                                  {selected ? 'Selezionato' : 'Seleziona'}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="ui-card ui-cardContent">
                  <div className="ui-body">
                    Crediti da usare: <span className="font-[var(--font-weight-bold)]">{creditsToSpend}</span>
                  </div>
                </div>

                {taxiAllowed ? (
                  <button
                    type="button"
                    onClick={() => setTaxiEnabled((v) => !v)}
                    className={['ui-selectCard', taxiEnabled ? 'ui-selectCard--selected' : ''].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3 ui-minw0">
                      <div className="ui-minw0">
                        <div className="ui-body font-[var(--font-weight-bold)]">Taxi dog</div>
                        <div className="ui-muted mt-1">Calcolo automatico distanza e prezzo.</div>
                      </div>
                      <div className={['ui-pill', taxiEnabled ? 'ui-pill--selected' : ''].join(' ')}>
                        {taxiEnabled ? 'Attivo' : 'Off'}
                      </div>
                    </div>

                    {taxiEnabled ? (
                      <div className="mt-3">
                        {taxiDistance.loading ? (
                          <div className="ui-muted">Calcolo distanza…</div>
                        ) : taxiDistance.error ? (
                          <div className="ui-dangerText">{taxiDistance.error}</div>
                        ) : taxiDistance.km !== null && taxiComputed.price !== null ? (
                          <TaxiQuote km={taxiDistance.km} priceEur={taxiComputed.price} />
                        ) : (
                          <div className="ui-muted">—</div>
                        )}
                      </div>
                    ) : null}
                  </button>
                ) : null}

                {missingWarn && !forceProceed ? (
                  <div className="ui-error">
                    <div className="ui-body font-[var(--font-weight-bold)]">Mancano alcuni dati</div>
                    <ul className="mt-2 space-y-1 ui-muted">
                      {missingWarn.map((m) => (
                        <li key={m}>• {m}</li>
                      ))}
                    </ul>

                    <div className="mt-3 grid gap-2">
                      <Button
                        variant="secondary"
                        fullWidth
                        onClick={() => {
                          onClose();
                          router.push('/account');
                        }}
                      >
                        Completa dati
                      </Button>

                      <Button
                        variant="primary"
                        fullWidth
                        onClick={() => {
                          setForceProceed(true);
                          void handleConfirm();
                        }}
                      >
                        Procedi comunque
                      </Button>
                    </div>
                  </div>
                ) : null}

                {bookingError ? <div className="ui-error">{bookingError}</div> : null}

                <Button
                  variant="primary"
                  fullWidth
                  disabled={!canConfirm || bookingState === 'loading'}
                  onClick={() => void handleConfirm()}
                >
                  {bookingState === 'loading' ? 'Confermo…' : 'Conferma prenotazione'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
