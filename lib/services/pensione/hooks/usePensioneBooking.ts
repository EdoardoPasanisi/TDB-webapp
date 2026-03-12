// lib/services/pensione/hooks/usePensioneBooking.ts
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

import type { TaxiDistanceBand, TaxiOption, AccommodationKey, BookingDogExtras } from '@/types/booking';
import { DEFAULT_TAXI, DEFAULT_TIMES } from '../constants';
import type { DogLite, PerDogForm } from '../types';
import {
  buildExtrasPayload,
  computeDaysCount,
  computePerDogTotals,
  computePricing,
  getTodayISO,
  validateTimeWindow,
} from '../utils';

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

type DogRow = {
  id: string;
  name: string;
  photo_path: string | null;
  updated_at: string | null;
  size_category: DogLite['size_category'];
  grooming_difficulty: DogLite['grooming_difficulty'];
};

type BookingDogEditRow = {
  dog_id: string;
  accommodation_type: AccommodationKey;
  extras: BookingDogExtras | null;
};

type TaxiDistanceApiResponse = {
  ok?: boolean;
  error?: string;
  km?: number;
};

function buildAddressFromProfile(profile: ProfileAddressRow | null): string {
  const line = (profile?.dog_address_line ?? '').trim();
  const city = (profile?.dog_city ?? '').trim();
  const zip = (profile?.dog_zip_code ?? '').trim();
  const prov = (profile?.dog_province ?? '').trim();

  // Componiamo in modo “friendly” per geocoding
  // Esempio: "Via Roma 10, 00100 Roma (RM), Italia"
  const parts: string[] = [];

  if (line) parts.push(line);

  const cityLine = [zip, city].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);

  if (prov) parts.push(`(${prov})`);

  // Per aiutare Nominatim, aggiungiamo sempre Italia (se non è già presente)
  const address = parts.join(', ').trim();
  if (!address) return '';

  if (!/italia/i.test(address)) {
    return `${address}, Italia`;
  }
  return address;
}

export function usePensioneBooking() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editBookingIdFromUrl = searchParams.get('editBookingId');

  const [loading, setLoading] = useState(true);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dogs, setDogs] = useState<DogLite[]>([]);
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);

  // Form globale
  const [startDate, setStartDate] = useState<string>(() => getTodayISO());
  const [endDate, setEndDate] = useState<string>(() => getTodayISO());
  const [arrivalTime, setArrivalTime] = useState<string>(DEFAULT_TIMES.ARRIVAL);
  const [departureTime, setDepartureTime] = useState<string>(DEFAULT_TIMES.DEPARTURE);

  const [taxiOption, setTaxiOption] = useState<TaxiOption>(DEFAULT_TAXI.option);
  const [taxiDistanceBand, setTaxiDistanceBand] = useState<TaxiDistanceBand>(
    DEFAULT_TAXI.distanceBand
  );

  const [taxiDistance, setTaxiDistance] = useState<TaxiDistanceState>({
    loading: false,
    error: null,
    km: null,
  });

  const [notes, setNotes] = useState('');
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

  // Form per-cane
  const [perDogForm, setPerDogForm] = useState<Record<string, PerDogForm>>({});

  // Caricamento cani
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        router.push('/login');
        return;
      }

      const userId = userData.user.id;

      const { data: dogsData, error: dogsError } = await supabase
        .from('dogs')
        .select('id, name, photo_path, updated_at, size_category, grooming_difficulty')
        .eq('owner_id', userId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (dogsError) {
        setError(dogsError.message);
        setLoading(false);
        return;
      }

      const dogsRows = (dogsData ?? []) as DogRow[];
      const dogList: DogLite[] = dogsRows.map((d) => ({
          id: d.id,
          name: d.name,
          photo_path: d.photo_path ?? null,
          updated_at: d.updated_at ?? null,
          size_category: d.size_category ?? null,
          grooming_difficulty: d.grooming_difficulty ?? null,
        }));


      setDogs(dogList);

      const initialPerDog: Record<string, PerDogForm> = {};
      for (const dog of dogList) {
        initialPerDog[dog.id] = {
          accommodationType: 'BOX',
          grooming: false,
          vaccine: false,
          trackingSessions: 0,
          fitnessSessions: 0,
          walkSessions: 0,
          therapy: '',
          therapyNotes: '',
        };
      }
      setPerDogForm(initialPerDog);

      if (dogList.length === 1) setSelectedDogIds([dogList[0].id]);
      else setSelectedDogIds([]);

      setLoading(false);
    };

    load();
  }, [router]);

  // ✅ Distanza taxi automatica
  useEffect(() => {
    const run = async () => {
      if (taxiOption === 'NONE') {
        setTaxiDistance({ loading: false, error: null, km: null });
        setTaxiDistanceBand(DEFAULT_TAXI.distanceBand);
        return;
      }

      setTaxiDistance((p) => ({ ...p, loading: true, error: null }));

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setTaxiDistance({ loading: false, error: 'Sessione scaduta.', km: null });
        return;
      }

      const userId = userData.user.id;

      // ✅ Nel tuo DB: profiles.user_id è la FK verso auth.users.id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('dog_address_line, dog_city, dog_zip_code, dog_province')
        .eq('user_id', userId)
        .maybeSingle();
      const profileRow = (profile ?? null) as ProfileAddressRow | null;

      if (profileError) {
        setTaxiDistance({ loading: false, error: profileError.message, km: null });
        return;
      }

	      const userAddress = buildAddressFromProfile(profileRow);

      if (!userAddress) {
        setTaxiDistance({
          loading: false,
          error: 'Indirizzo taxi dog incompleto nel profilo. Compila almeno via e città.',
          km: null,
        });
        return;
      }

      const url = new URL('/api/taxi-distance', window.location.origin);
      url.searchParams.set('userAddress', userAddress);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = (await res.json()) as TaxiDistanceApiResponse;

      if (!json?.ok) {
        setTaxiDistance({
          loading: false,
          error: json?.error ?? 'Errore distanza taxi.',
          km: null,
        });
        return;
      }

      const km = Number(json.km);
      if (!Number.isFinite(km)) {
        setTaxiDistance({ loading: false, error: 'Distanza non valida.', km: null });
        return;
      }

      const band: TaxiDistanceBand = km <= 40 ? 'ENTRO_40' : 'OLTRE_40';
      setTaxiDistanceBand(band);
      setTaxiDistance({ loading: false, error: null, km });
    };

    run();
  }, [taxiOption]);

  // Caricamento prenotazione in modifica
  useEffect(() => {
    const loadBookingToEdit = async () => {
      if (!editBookingIdFromUrl) return;

      setLoadingEdit(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        router.push('/login');
        return;
      }
      const userId = userData.user.id;

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(
          'id, user_id, service_type, start_date, end_date, arrival_time, departure_time, notes, taxi_option, taxi_distance_band'
        )
        .eq('id', editBookingIdFromUrl)
        .eq('user_id', userId)
        .maybeSingle();

      if (bookingError) {
        setError(`Errore Supabase (bookings): ${bookingError.message}`);
        setLoadingEdit(false);
        return;
      }

      if (!bookingData) {
        setError('Prenotazione da modificare non trovata.');
        setLoadingEdit(false);
        return;
      }

      if (bookingData.service_type !== 'PENSIONE') {
        setError('Questa pagina modifica solo prenotazioni di pensione.');
        setLoadingEdit(false);
        return;
      }

      const { data: bookingDogsData, error: bookingDogsError } = await supabase
        .from('booking_dogs')
        .select('dog_id, accommodation_type, extras')
        .eq('booking_id', editBookingIdFromUrl);

      if (bookingDogsError) {
        setError(`Errore Supabase (booking_dogs): ${bookingDogsError.message}`);
        setLoadingEdit(false);
        return;
      }

      const bookingDogs = bookingDogsData ?? [];

      setStartDate(bookingData.start_date ?? '');
      setEndDate(bookingData.end_date ?? '');
      setArrivalTime(bookingData.arrival_time ?? DEFAULT_TIMES.ARRIVAL);
      setDepartureTime(bookingData.departure_time ?? DEFAULT_TIMES.DEPARTURE);
      setNotes(bookingData.notes ?? '');
      setTaxiOption((bookingData.taxi_option as TaxiOption) ?? DEFAULT_TAXI.option);

      setTaxiDistanceBand(
        (bookingData.taxi_distance_band as TaxiDistanceBand) ?? DEFAULT_TAXI.distanceBand
      );

      const bookingDogRows = bookingDogs as BookingDogEditRow[];
      const dogIds = bookingDogRows.map((bd) => bd.dog_id);
      setSelectedDogIds(dogIds);

      const newPerDog: Record<string, PerDogForm> = {};
      for (const bd of bookingDogRows) {
        const extras = bd.extras ?? {};

        newPerDog[bd.dog_id] = {
          accommodationType: bd.accommodation_type,
          grooming: !!extras.grooming,
          vaccine: !!extras.vaccine,
          trackingSessions: extras.trackingSessions ?? 0,
          fitnessSessions: extras.fitnessSessions ?? 0,
          walkSessions: extras.walkSessions ?? 0,
          therapy: extras.therapyActive ? 'YES' : 'NO',
          therapyNotes: extras.therapyNotes ?? '',
        };
      }

      setPerDogForm((prev) => ({ ...prev, ...newPerDog }));
      setEditingBookingId(bookingData.id as string);
      setLoadingEdit(false);
    };

    loadBookingToEdit();
  }, [editBookingIdFromUrl, router]);

  const isSingleDog = dogs.length === 1;
  const effectiveSelectedDogIds = useMemo(
    () => (isSingleDog && dogs[0] ? [dogs[0].id] : selectedDogIds),
    [isSingleDog, dogs, selectedDogIds],
  );

  const toggleDogSelection = useCallback(
    (dogId: string) => {
      if (isSingleDog) return;

      setSelectedDogIds((prev) => {
        if (prev.includes(dogId)) return prev.filter((id) => id !== dogId);
        return [...prev, dogId];
      });
    },
    [isSingleDog]
  );

  const updatePerDogField = useCallback(
    (dogId: string, field: keyof PerDogForm, value: PerDogForm[keyof PerDogForm]) => {
      setPerDogForm((prev) => ({
        ...prev,
        [dogId]: {
          ...prev[dogId],
          [field]: value,
        },
      }));
    },
    []
  );

  const daysCount = useMemo(() => {
    return computeDaysCount(startDate, endDate, departureTime);
  }, [startDate, endDate, departureTime]);

  const pricing = useMemo(() => {
    return computePricing({
      selectedDogIds: effectiveSelectedDogIds,
      daysCount,
      dogs,
      perDogForm,
      taxiOption,
      taxiDistanceBand,
    });
  }, [effectiveSelectedDogIds, daysCount, dogs, perDogForm, taxiOption, taxiDistanceBand]);

  const handleCancelEdit = useCallback(() => {
    if (editingBookingId) router.push(`/services/booking/${editingBookingId}`);
    else router.push('/services');
  }, [editingBookingId, router]);

  const submit = useCallback(async () => {
    setError(null);

    if (dogs.length === 0) return setError('Devi prima registrare almeno un cane.');
    if (effectiveSelectedDogIds.length === 0)
      return setError('Seleziona almeno un cane per la prenotazione.');

    if (!startDate) return setError('Seleziona la data di inizio.');
    if (!endDate) return setError('Seleziona la data di fine.');
    if (endDate < startDate)
      return setError('La data di partenza deve essere uguale o successiva alla data di arrivo.');

    if (!departureTime) {
      return setError(
        'Seleziona l’orario di partenza (mattina o pomeriggio) per calcolare correttamente i giorni.'
      );
    }

    const arrivalErr = validateTimeWindow('L’orario di arrivo', arrivalTime);
    if (arrivalErr) return setError(arrivalErr);

    const departureErr = validateTimeWindow('L’orario di partenza', departureTime);
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
        return setError(
          `Hai selezionato terapia attiva per ${dogName}: inserisci i dettagli della terapia (farmaco, dose e orari).`
        );
      }
    }

    if (taxiOption !== 'NONE') {
      if (taxiDistance.loading) return setError('Calcolo distanza taxi in corso...');
      if (taxiDistance.error) return setError(taxiDistance.error);
      if (taxiDistance.km == null) return setError('Impossibile calcolare la distanza taxi.');
    }

    if (pricing.totalPrice <= 0) {
      return setError('Impossibile calcolare il prezzo. Controlla i dati inseriti.');
    }

    setSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setSaving(false);
        router.push('/login');
        return;
      }

      const userId = userData.user.id;
      const firstDogId = effectiveSelectedDogIds[0];
      let bookingId: string;

      const taxi_pickup_time =
        taxiOption === 'ONE_WAY' || taxiOption === 'ROUND_TRIP' ? arrivalTime || null : null;
      const taxi_return_time =
        taxiOption === 'RETURN_ONLY' || taxiOption === 'ROUND_TRIP'
          ? departureTime || null
          : null;

      const bookingPayload = {
        dog_id: firstDogId,
        service_type: 'PENSIONE',
        start_date: startDate,
        end_date: endDate,
        arrival_time: arrivalTime || null,
        departure_time: departureTime || null,
        notes: notes || null,
        dogs_count: pricing.dogsCount,
        taxi_option: taxiOption,
        taxi_distance_band: taxiDistanceBand,
        taxi_price: pricing.taxiPrice,
        taxi_pickup_time,
        taxi_return_time,
        alloggio_total_full: pricing.alloggioTotalFull,
        alloggio_discount_percent: pricing.discountPercent,
        alloggio_total_discounted: pricing.alloggioTotalDiscounted,
        extras_total: pricing.extrasTotal,
        total_price: pricing.totalPrice,
      };

      if (editingBookingId) {
        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update(bookingPayload)
          .eq('id', editingBookingId)
          .eq('user_id', userId);

        if (bookingUpdateError) {
          setSaving(false);
          return setError('Errore nel salvataggio della prenotazione (update).');
        }

        bookingId = editingBookingId;

        const { error: deleteError } = await supabase
          .from('booking_dogs')
          .delete()
          .eq('booking_id', bookingId);

        if (deleteError) {
          setSaving(false);
          return setError('Errore durante l’aggiornamento del dettaglio per cane (delete).');
        }
      } else {
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .insert({ user_id: userId, status: 'PENDING', ...bookingPayload })
          .select()
          .single();

        if (bookingError || !bookingData) {
          setSaving(false);
          return setError('Errore nel salvataggio della prenotazione.');
        }

        bookingId = bookingData.id as string;
        setEditingBookingId(bookingId);
      }

      const bookingDogsPayload = effectiveSelectedDogIds.map((dogId) => {
        const form = perDogForm[dogId];
        const dog = dogs.find((d) => d.id === dogId);
        if (!dog) throw new Error('Dati cane mancanti.');

        const extras = buildExtrasPayload(form);
        const totals = computePerDogTotals({ dog, form, daysCount });

        return {
          booking_id: bookingId,
          dog_id: dogId,
          accommodation_type: form.accommodationType,
          accommodation_price_per_day: totals.accommodation_price_per_day,
          days_count: daysCount,
          accommodation_subtotal: totals.accommodation_subtotal,
          extras,
          extras_subtotal: totals.extras_subtotal,
          per_dog_total: totals.per_dog_total,
        };
      });

      const { error: bookingDogsError } = await supabase
        .from('booking_dogs')
        .insert(bookingDogsPayload);

      if (bookingDogsError) {
        setSaving(false);
        return setError(
          'La prenotazione principale è stata salvata, ma c’è stato un errore sul dettaglio per cane.'
        );
      }

      setSaving(false);
      router.push('/services');
    } catch (e) {
      console.error(e);
      setSaving(false);
      setError('Errore inatteso durante il salvataggio.');
    }
  }, [
    dogs,
    effectiveSelectedDogIds,
    startDate,
    endDate,
    arrivalTime,
    departureTime,
    taxiOption,
    taxiDistanceBand,
    taxiDistance,
    pricing,
    perDogForm,
    daysCount,
    notes,
    editingBookingId,
    router,
  ]);

  return {
    loading: loading || loadingEdit,
    saving,
    error,

    dogs,
    isSingleDog,
    effectiveSelectedDogIds,

    startDate,
    endDate,
    arrivalTime,
    departureTime,

    taxiOption,
    taxiDistanceBand,
    taxiDistance,

    notes,

    perDogForm,

    daysCount,
    pricing,

    setStartDate,
    setEndDate,
    setArrivalTime,
    setDepartureTime,

    setTaxiOption,
    setNotes,

    toggleDogSelection,
    updatePerDogField,

    editingBookingId,
    handleCancelEdit,
    submit,
    setError,
  };
}
