'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModalFrame } from '@/components/admin/shared';
import { PensioneBookingForm } from '@/components/services/pensione/PensioneBookingForm';
import { fetchAdminJson } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import {
  DEFAULT_TAXI,
  DEFAULT_TIMES,
  defaultAccommodationForSpecies,
} from '@/lib/services/pensione/constants';
import {
  computeDaysCount,
  computePricing,
  getTodayISO,
  normalizeSundayTime,
  validateTimeWindow,
} from '@/lib/services/pensione/utils';
import type { DogLite, PerDogForm } from '@/lib/services/pensione/types';
import type { PetSpecies } from '@/types/dog';
import type { TaxiDistanceBand, TaxiOption } from '@/types/booking';

type AdminDogRow = {
  id: string;
  name: string;
  photo_path: string | null;
  updated_at: string | null;
  size_category: DogLite['size_category'];
  grooming_difficulty: DogLite['grooming_difficulty'];
  species: PetSpecies | null;
  microchip: string | null;
  birth_date: string | null;
  libretto_name: string | null;
};

type TaxiServiceAddressForm = {
  dog_address_line: string;
  dog_city: string;
  dog_zip_code: string;
  dog_province: string;
};

const EMPTY_TAXI_ADDRESS: TaxiServiceAddressForm = {
  dog_address_line: '',
  dog_city: '',
  dog_zip_code: '',
  dog_province: '',
};

function buildAddressFromForm(address: TaxiServiceAddressForm): string {
  const parts: string[] = [];
  if (address.dog_address_line.trim()) parts.push(address.dog_address_line.trim());
  const cityLine = [address.dog_zip_code.trim(), address.dog_city.trim()].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);
  if (address.dog_province.trim()) parts.push(`(${address.dog_province.trim()})`);
  const composed = parts.join(', ').trim();
  if (!composed) return '';
  return /italia/i.test(composed) ? composed : `${composed}, Italia`;
}

function hasTaxiAddressMinimum(address: TaxiServiceAddressForm): boolean {
  return address.dog_address_line.trim().length > 0 && address.dog_city.trim().length > 0;
}

export function CreatePensioneBookingModal({
  open,
  onClose,
  userId,
  userName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  userName: string;
  onCreated?: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dogs, setDogs] = useState<DogLite[]>([]);
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);
  const [perDogForm, setPerDogForm] = useState<Record<string, PerDogForm>>({});

  const [startDate, setStartDate] = useState(getTodayISO());
  const [endDate, setEndDate] = useState(getTodayISO());
  const [arrivalTime, setArrivalTime] = useState<string>(DEFAULT_TIMES.ARRIVAL);
  const [departureTime, setDepartureTime] = useState<string>(DEFAULT_TIMES.DEPARTURE);
  const [notes, setNotes] = useState('');

  const [taxiOption, setTaxiOption] = useState<TaxiOption>(DEFAULT_TAXI.option);
  const [taxiDistanceBand, setTaxiDistanceBand] = useState<TaxiDistanceBand>(DEFAULT_TAXI.distanceBand);
  const [taxiDistance, setTaxiDistance] = useState<{
    loading: boolean;
    error: string | null;
    km: number | null;
    approx: boolean;
  }>({ loading: false, error: null, km: null, approx: false });
  const [taxiServiceAddress, setTaxiServiceAddress] = useState<TaxiServiceAddressForm>(EMPTY_TAXI_ADDRESS);
  const [taxiServiceAddressDirty, setTaxiServiceAddressDirty] = useState(false);

  const resetState = useCallback(() => {
    setDogs([]);
    setSelectedDogIds([]);
    setPerDogForm({});
    setStartDate(getTodayISO());
    setEndDate(getTodayISO());
    setArrivalTime(DEFAULT_TIMES.ARRIVAL);
    setDepartureTime(DEFAULT_TIMES.DEPARTURE);
    setNotes('');
    setTaxiOption(DEFAULT_TAXI.option);
    setTaxiDistanceBand(DEFAULT_TAXI.distanceBand);
    setTaxiDistance({ loading: false, error: null, km: null, approx: false });
    setTaxiServiceAddress(EMPTY_TAXI_ADDRESS);
    setTaxiServiceAddressDirty(false);
    setError(null);
  }, []);

  // Carica i cani prenotabili del cliente all'apertura.
  useEffect(() => {
    if (!open || !userId) return;

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchAdminJson<{ dogs: AdminDogRow[] }>(
          `/api/admin/pensione-bookings?userId=${encodeURIComponent(userId)}`
        );
        if (cancelled) return;

        const dogList: DogLite[] = (payload.dogs ?? []).map((dog) => ({
          id: dog.id,
          name: dog.name,
          photo_path: dog.photo_path ?? null,
          updated_at: dog.updated_at ?? null,
          size_category: dog.size_category ?? null,
          grooming_difficulty: dog.grooming_difficulty ?? null,
          species: dog.species ?? 'DOG',
          microchip: dog.microchip ?? null,
          birth_date: dog.birth_date ?? null,
          libretto_name: dog.libretto_name ?? null,
        }));

        const initialPerDog: Record<string, PerDogForm> = {};
        for (const dog of dogList) {
          initialPerDog[dog.id] = {
            accommodationType: defaultAccommodationForSpecies(dog.species ?? 'DOG'),
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

        setDogs(dogList);
        setPerDogForm(initialPerDog);
        setSelectedDogIds(dogList.length === 1 ? [dogList[0].id] : []);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i cani del cliente.'));
        setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // Distanza taxi automatica (come nel flusso utente, senza salvare l'indirizzo).
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const run = async () => {
      if (taxiOption === 'NONE') {
        setTaxiDistance({ loading: false, error: null, km: null, approx: false });
        setTaxiDistanceBand(DEFAULT_TAXI.distanceBand);
        return;
      }
      if (!hasTaxiAddressMinimum(taxiServiceAddress)) {
        setTaxiDistance({
          loading: false,
          error: 'Inserisci l’indirizzo servizi per usare il taxi dog.',
          km: null,
          approx: false,
        });
        return;
      }

      setTaxiDistance((prev) => ({ ...prev, loading: true, error: null, approx: false }));

      const applyMaxTariffFallback = () => {
        if (cancelled) return;
        setTaxiDistanceBand('OLTRE_40');
        setTaxiDistance({ loading: false, error: null, km: null, approx: true });
      };

      try {
        const res = await fetch('/api/taxi-distance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ address: buildAddressFromForm(taxiServiceAddress) }),
        });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; km?: number } | null;
        if (cancelled) return;
        const km = json?.ok ? Number(json.km) : Number.NaN;
        if (!json?.ok || !Number.isFinite(km)) {
          applyMaxTariffFallback();
          return;
        }
        setTaxiDistanceBand(km <= 40 ? 'ENTRO_40' : 'OLTRE_40');
        setTaxiDistance({ loading: false, error: null, km, approx: false });
      } catch {
        applyMaxTariffFallback();
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [open, taxiOption, taxiServiceAddress]);

  const isSingleDog = dogs.length === 1;
  const effectiveSelectedDogIds = useMemo(
    () => (isSingleDog && dogs[0] ? [dogs[0].id] : selectedDogIds),
    [isSingleDog, dogs, selectedDogIds]
  );

  const daysCount = useMemo(
    () => computeDaysCount(startDate, endDate, departureTime),
    [startDate, endDate, departureTime]
  );

  const pricing = useMemo(
    () =>
      computePricing({
        selectedDogIds: effectiveSelectedDogIds,
        daysCount,
        dogs,
        perDogForm,
        taxiOption,
        taxiDistanceBand,
      }),
    [effectiveSelectedDogIds, daysCount, dogs, perDogForm, taxiOption, taxiDistanceBand]
  );

  const toggleDogSelection = useCallback(
    (dogId: string) => {
      if (isSingleDog) return;
      setSelectedDogIds((prev) =>
        prev.includes(dogId) ? prev.filter((id) => id !== dogId) : [...prev, dogId]
      );
    },
    [isSingleDog]
  );

  const updatePerDogField = useCallback(
    (dogId: string, field: keyof PerDogForm, value: PerDogForm[keyof PerDogForm]) => {
      setPerDogForm((prev) => ({ ...prev, [dogId]: { ...prev[dogId], [field]: value } }));
    },
    []
  );

  const updateTaxiServiceAddressField = useCallback(
    (field: keyof TaxiServiceAddressForm, value: string) => {
      setTaxiServiceAddress((current) => ({ ...current, [field]: value }));
      setTaxiServiceAddressDirty(true);
    },
    []
  );

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const submit = useCallback(async () => {
    if (!userId) return;
    setError(null);

    if (dogs.length === 0) return setError('Questo cliente non ha pet prenotabili in pensione.');
    if (effectiveSelectedDogIds.length === 0) return setError('Seleziona almeno un pet.');
    if (!startDate) return setError('Seleziona la data di inizio.');
    if (!endDate) return setError('Seleziona la data di fine.');
    if (endDate < startDate)
      return setError('La data di partenza deve essere uguale o successiva alla data di arrivo.');

    const arrivalErr = validateTimeWindow('L’orario di arrivo', arrivalTime, startDate);
    if (arrivalErr) return setError(arrivalErr);
    const departureErr = validateTimeWindow('L’orario di partenza', departureTime, endDate);
    if (departureErr) return setError(departureErr);

    for (const dogId of effectiveSelectedDogIds) {
      const form = perDogForm[dogId];
      if (!form) continue;
      if (form.therapy === '') {
        const dogName = dogs.find((d) => d.id === dogId)?.name ?? 'il cane';
        return setError(`Seleziona “Terapia in corso” (Sì/No) per ${dogName}.`);
      }
      if (form.therapy === 'YES' && !form.therapyNotes.trim()) {
        const dogName = dogs.find((d) => d.id === dogId)?.name ?? 'il cane';
        return setError(`Inserisci i dettagli della terapia per ${dogName}.`);
      }
    }

    if (pricing.totalPrice <= 0) {
      return setError('Impossibile calcolare il prezzo. Controlla i dati inseriti.');
    }

    if (taxiOption !== 'NONE' && !hasTaxiAddressMinimum(taxiServiceAddress)) {
      return setError('Per usare il taxi dog inserisci l’indirizzo servizi oppure rimuovi il taxi dog.');
    }

    setSaving(true);
    try {
      await fetchAdminJson('/api/admin/pensione-bookings', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          startDate,
          endDate,
          arrivalTime,
          departureTime,
          notes,
          taxiOption,
          taxiDistanceBand,
          selectedDogIds: effectiveSelectedDogIds,
          perDogForm,
        }),
      });
      setSaving(false);
      await onCreated?.();
      handleClose();
    } catch (err) {
      setSaving(false);
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a creare la prenotazione.'));
    }
  }, [
    userId,
    dogs,
    effectiveSelectedDogIds,
    startDate,
    endDate,
    arrivalTime,
    departureTime,
    notes,
    taxiOption,
    taxiDistanceBand,
    taxiServiceAddress,
    perDogForm,
    pricing,
    onCreated,
    handleClose,
  ]);

  return (
    <ModalFrame open={open} title={`Crea prenotazione pensione — ${userName}`} onClose={handleClose}>
      {loading ? (
        <p className="ui-muted">Caricamento cani del cliente…</p>
      ) : (
        <PensioneBookingForm
          title="Nuova prenotazione (gestionale)"
          error={error}
          missingRequiredFields={[]}
          missingPetFields={[]}
          saving={saving}
          dogs={dogs}
          isSingleDog={isSingleDog}
          selectedDogIds={effectiveSelectedDogIds}
          startDate={startDate}
          endDate={endDate}
          arrivalTime={arrivalTime}
          departureTime={departureTime}
          taxiOption={taxiOption}
          taxiDistanceBand={taxiDistanceBand}
          taxiDistance={taxiDistance}
          taxiServiceAddress={taxiServiceAddress}
          showTaxiServiceAddressEditor={taxiServiceAddressDirty || !hasTaxiAddressMinimum(taxiServiceAddress)}
          notes={notes}
          perDogForm={perDogForm}
          daysCount={daysCount}
          pricing={pricing}
          onToggleDog={toggleDogSelection}
          onChangeStartDate={(v) => {
            setStartDate(v);
            setArrivalTime((current) => normalizeSundayTime(current, v));
          }}
          onChangeEndDate={(v) => {
            setEndDate(v);
            setDepartureTime((current) => normalizeSundayTime(current, v));
          }}
          onChangeArrivalTime={(v) => setArrivalTime(normalizeSundayTime(v, startDate))}
          onChangeDepartureTime={(v) => setDepartureTime(normalizeSundayTime(v, endDate))}
          onChangeTaxiOption={setTaxiOption}
          onChangeTaxiServiceAddressField={updateTaxiServiceAddressField}
          onChangeNotes={setNotes}
          onUpdatePerDogField={updatePerDogField}
          onCancelEdit={handleClose}
          onCompleteRequiredProfile={() => {}}
          onSubmit={submit}
          showCancelEdit={false}
        />
      )}
    </ModalFrame>
  );
}
