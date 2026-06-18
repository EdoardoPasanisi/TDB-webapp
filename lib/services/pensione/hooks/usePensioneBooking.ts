// lib/services/pensione/hooks/usePensioneBooking.ts
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { updateProfileForCurrentUser } from '@/lib/account/profileApi';

import type { TaxiDistanceBand, TaxiOption, AccommodationKey, BookingDogExtras } from '@/types/booking';
import type { PetSpecies } from '@/types/dog';
import {
  getMissingRequiredCustomerBookingFields,
  getMissingRequiredPetBookingFields,
} from '@/lib/bookings/customerBookingRequirements';
import { defaultAccommodationForSpecies } from '../constants';
import {
  buildPensioneBookingDraftKey,
  clearBookingDraft,
  readBookingDraft,
  writeBookingDraft,
} from '@/lib/bookings/bookingDrafts';
import { DEFAULT_TAXI, DEFAULT_TIMES } from '../constants';
import type { DogLite, PerDogForm } from '../types';
import { savePensioneBooking } from '../api';
import {
  computeDaysCount,
  computePricing,
  getTodayISO,
  normalizeSundayTime,
  validateTimeWindow,
} from '../utils';

type TaxiDistanceState = {
  loading: boolean;
  error: string | null;
  km: number | null;
};

type TaxiServiceAddressForm = {
  dog_address_line: string;
  dog_city: string;
  dog_zip_code: string;
  dog_province: string;
};

type ProfileAddressRow = Partial<TaxiServiceAddressForm>;

type DogRow = {
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

type RequiredBookingProfileRow = import('@/lib/bookings/customerBookingRequirements').CustomerBookingRequirementProfile;

type PensioneBookingDraft = {
  startDate: string;
  endDate: string;
  arrivalTime: string;
  departureTime: string;
  taxiOption: TaxiOption;
  notes: string;
  selectedDogIds: string[];
  perDogForm: Record<string, PerDogForm>;
};

const EMPTY_TAXI_SERVICE_ADDRESS: TaxiServiceAddressForm = {
  dog_address_line: '',
  dog_city: '',
  dog_zip_code: '',
  dog_province: '',
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

function normalizeTaxiServiceAddress(profile: ProfileAddressRow | null): TaxiServiceAddressForm {
  return {
    dog_address_line: String(profile?.dog_address_line ?? '').trim(),
    dog_city: String(profile?.dog_city ?? '').trim(),
    dog_zip_code: String(profile?.dog_zip_code ?? '').trim(),
    dog_province: String(profile?.dog_province ?? '').trim(),
  };
}

function hasTaxiServiceAddressMinimum(address: ProfileAddressRow | null): boolean {
  return (
    String(address?.dog_address_line ?? '').trim().length > 0 &&
    String(address?.dog_city ?? '').trim().length > 0
  );
}

export function usePensioneBooking() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editBookingIdFromUrl = searchParams.get('editBookingId');

  const [loading, setLoading] = useState(true);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>([]);
  const [missingPetFields, setMissingPetFields] = useState<string[]>([]);
  const [draftKey, setDraftKey] = useState<string | null>(null);

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
  const [taxiServiceAddress, setTaxiServiceAddress] = useState<TaxiServiceAddressForm>(
    EMPTY_TAXI_SERVICE_ADDRESS
  );
  const [taxiServiceAddressDirty, setTaxiServiceAddressDirty] = useState(false);

  const [notes, setNotes] = useState('');
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

  // Form per-cane
  const [perDogForm, setPerDogForm] = useState<Record<string, PerDogForm>>({});

  const normalizeSelectedDogIds = useCallback(
    (candidateIds: string[], dogList: DogLite[]) => {
      if (dogList.length === 1 && dogList[0]) return [dogList[0].id];

      const validDogIds = new Set(dogList.map((dog) => dog.id));
      return candidateIds.filter((dogId) => validDogIds.has(dogId));
    },
    []
  );

  const mergeDraftPerDogForm = useCallback(
    (dogList: DogLite[], baseForm: Record<string, PerDogForm>, draftForm: Record<string, PerDogForm> | null | undefined) => {
      const nextForm = { ...baseForm };

      if (!draftForm) return nextForm;

      for (const dog of dogList) {
        const savedForm = draftForm[dog.id];
        if (!savedForm) continue;
        nextForm[dog.id] = { ...nextForm[dog.id], ...savedForm };
      }

      return nextForm;
    },
    []
  );

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

      const [{ data: dogsData, error: dogsError }, { data: profileData, error: profileError }] =
        await Promise.all([
          supabase
            .from('dogs')
            .select('id, name, photo_path, updated_at, size_category, grooming_difficulty, species, microchip, birth_date, libretto_name')
            .eq('owner_id', userId)
            .eq('is_active', true)
            .order('name', { ascending: true }),
          supabase
            .from('profiles')
            .select(
              'first_name, last_name, phone, fiscal_code, address_line, city, zip_code, province, id_document_path, dog_address_line, dog_city, dog_zip_code, dog_province'
            )
            .eq('user_id', userId)
            .maybeSingle(),
        ]);

      if (dogsError) {
        setError(humanizeErrorMessage(dogsError, 'Non siamo riusciti a caricare i cani registrati.'));
        setLoading(false);
        return;
      }

      if (profileError) {
        setError(
          humanizeErrorMessage(
            profileError,
            'Non siamo riusciti a leggere l’indirizzo servizi del profilo.'
          )
        );
      }

      setTaxiServiceAddress(normalizeTaxiServiceAddress((profileData ?? null) as ProfileAddressRow | null));
      setTaxiServiceAddressDirty(false);

      const dogsRows = (dogsData ?? []) as DogRow[];
      // In pensione si prenotano solo cani e gatti ("altro" non è prenotabile).
      const dogList: DogLite[] = dogsRows
        .filter((d) => (d.species ?? 'DOG') !== 'OTHER')
        .map((d) => ({
          id: d.id,
          name: d.name,
          photo_path: d.photo_path ?? null,
          updated_at: d.updated_at ?? null,
          size_category: d.size_category ?? null,
          grooming_difficulty: d.grooming_difficulty ?? null,
          species: d.species ?? 'DOG',
          microchip: d.microchip ?? null,
          birth_date: d.birth_date ?? null,
          libretto_name: d.libretto_name ?? null,
        }));

      setDogs(dogList);

      // Mostra subito i dati proprietario mancanti (alert all'ingresso pensione).
      setMissingRequiredFields(
        getMissingRequiredCustomerBookingFields((profileData ?? null) as RequiredBookingProfileRow | null)
      );

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
          therapy: '',
          therapyNotes: '',
        };
      }

      if (editBookingIdFromUrl) {
        setPerDogForm(initialPerDog);
        if (dogList.length === 1) setSelectedDogIds([dogList[0].id]);
        else setSelectedDogIds([]);
      } else {
        const nextDraftKey = buildPensioneBookingDraftKey(userId, null);
        const draft = readBookingDraft<PensioneBookingDraft>(nextDraftKey);
        const nextPerDogForm = mergeDraftPerDogForm(dogList, initialPerDog, draft?.perDogForm);

        setStartDate(draft?.startDate ?? getTodayISO());
        setEndDate(draft?.endDate ?? getTodayISO());
        setArrivalTime(draft?.arrivalTime ?? DEFAULT_TIMES.ARRIVAL);
        setDepartureTime(draft?.departureTime ?? DEFAULT_TIMES.DEPARTURE);
        setTaxiOption(draft?.taxiOption ?? DEFAULT_TAXI.option);
        setNotes(draft?.notes ?? '');
        setPerDogForm(nextPerDogForm);
        setSelectedDogIds(
          normalizeSelectedDogIds(draft?.selectedDogIds ?? [], dogList)
        );
        setDraftKey(nextDraftKey);
      }

      setLoading(false);
    };

    load();
  }, [editBookingIdFromUrl, mergeDraftPerDogForm, normalizeSelectedDogIds, router]);

  // ✅ Distanza taxi automatica
  useEffect(() => {
    const run = async () => {
      if (taxiOption === 'NONE') {
        setTaxiDistance({ loading: false, error: null, km: null });
        setTaxiDistanceBand(DEFAULT_TAXI.distanceBand);
        return;
      }

      if (!hasTaxiServiceAddressMinimum(taxiServiceAddress)) {
        setTaxiDistance({
          loading: false,
          error: 'Inserisci l’indirizzo servizi per usare il taxi dog.',
          km: null,
        });
        return;
      }

      setTaxiDistance((p) => ({ ...p, loading: true, error: null }));

      const userAddress = buildAddressFromProfile(taxiServiceAddress);

      const res = await fetch('/api/taxi-distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ address: userAddress }),
      });
      const json = (await res.json()) as TaxiDistanceApiResponse;

      if (!json?.ok) {
        setTaxiDistance({
          loading: false,
          error: humanizeErrorMessage(
            json?.error,
            'Non siamo riusciti a calcolare la distanza del taxi dog.'
          ),
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
  }, [taxiOption, taxiServiceAddress]);

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
        setError(
          humanizeErrorMessage(
            bookingError,
            'Non siamo riusciti a caricare la prenotazione da modificare.'
          )
        );
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
        setError(
          humanizeErrorMessage(
            bookingDogsError,
            'Non siamo riusciti a caricare i dettagli dei cani nella prenotazione.'
          )
        );
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
          trekkingSessions: extras.trekkingSessions ?? 0,
          therapy: extras.therapyActive ? 'YES' : 'NO',
          therapyNotes: extras.therapyNotes ?? '',
        };
      }

      const nextDraftKey = buildPensioneBookingDraftKey(userId, bookingData.id as string);
      const draft = readBookingDraft<PensioneBookingDraft>(nextDraftKey);

      setSelectedDogIds(normalizeSelectedDogIds(draft?.selectedDogIds ?? dogIds, dogs));
      setPerDogForm((prev) => mergeDraftPerDogForm(dogs, { ...prev, ...newPerDog }, draft?.perDogForm));
      setStartDate(draft?.startDate ?? (bookingData.start_date ?? ''));
      setEndDate(draft?.endDate ?? (bookingData.end_date ?? ''));
      setArrivalTime(draft?.arrivalTime ?? (bookingData.arrival_time ?? DEFAULT_TIMES.ARRIVAL));
      setDepartureTime(draft?.departureTime ?? (bookingData.departure_time ?? DEFAULT_TIMES.DEPARTURE));
      setNotes(draft?.notes ?? (bookingData.notes ?? ''));
      setTaxiOption(draft?.taxiOption ?? ((bookingData.taxi_option as TaxiOption) ?? DEFAULT_TAXI.option));
      setEditingBookingId(bookingData.id as string);
      setDraftKey(nextDraftKey);
      setLoadingEdit(false);
    };

    loadBookingToEdit();
  }, [dogs, editBookingIdFromUrl, mergeDraftPerDogForm, normalizeSelectedDogIds, router]);

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

  const updateTaxiServiceAddressField = useCallback(
    (field: keyof TaxiServiceAddressForm, value: string) => {
      setTaxiServiceAddress((current) => ({
        ...current,
        [field]: value,
      }));
      setTaxiServiceAddressDirty(true);
    },
    []
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

  useEffect(() => {
    if (!draftKey) return;

    writeBookingDraft(draftKey, {
      startDate,
      endDate,
      arrivalTime,
      departureTime,
      taxiOption,
      notes,
      selectedDogIds,
      perDogForm,
    } satisfies PensioneBookingDraft);
  }, [
    arrivalTime,
    departureTime,
    draftKey,
    endDate,
    notes,
    perDogForm,
    selectedDogIds,
    startDate,
    taxiOption,
  ]);

  const loadMissingRequiredProfileFields = useCallback(async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      router.push('/login');
      return ['Nome', 'Cognome', 'Numero di telefono'];
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone, fiscal_code, address_line, city, zip_code, province, id_document_path')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(
        humanizeErrorMessage(profileError, 'Non siamo riusciti a verificare i dati del profilo.')
      );
    }

    return getMissingRequiredCustomerBookingFields(
      (profile ?? null) as RequiredBookingProfileRow | null
    );
  }, [router]);

  const handleCancelEdit = useCallback(() => {
    if (editingBookingId) router.push(`/services/booking/${editingBookingId}`);
    else router.push('/services');
  }, [editingBookingId, router]);

  const submit = useCallback(async () => {
    setError(null);
    setMissingRequiredFields([]);
    setMissingPetFields([]);

    if (dogs.length === 0) return setError('Devi prima registrare almeno un pet.');
    if (effectiveSelectedDogIds.length === 0)
      return setError('Seleziona almeno un pet per la prenotazione.');

    if (!startDate) return setError('Seleziona la data di inizio.');
    if (!endDate) return setError('Seleziona la data di fine.');
    if (endDate < startDate)
      return setError('La data di partenza deve essere uguale o successiva alla data di arrivo.');

    if (!departureTime) {
      return setError(
        'Seleziona l’orario di partenza (mattina o pomeriggio) per calcolare correttamente i giorni.'
      );
    }

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
        return setError(
          `Hai selezionato terapia attiva per ${dogName}: inserisci i dettagli della terapia (farmaco, dose e orari).`
        );
      }
    }

    if (taxiOption !== 'NONE') {
      if (!hasTaxiServiceAddressMinimum(taxiServiceAddress)) {
        return setError(
          'Per usare il taxi dog inserisci l’indirizzo servizi oppure rimuovi il taxi dog dalla prenotazione.'
        );
      }
      if (taxiDistance.loading) return setError('Calcolo distanza taxi in corso...');
      if (taxiDistance.error) return setError(taxiDistance.error);
      if (taxiDistance.km == null) return setError('Impossibile calcolare la distanza taxi.');
    }

    if (pricing.totalPrice <= 0) {
      return setError('Impossibile calcolare il prezzo. Controlla i dati inseriti.');
    }

    // Requisiti pet (anno di nascita; microchip + libretto per i cani).
    const petMissing: string[] = [];
    for (const dogId of effectiveSelectedDogIds) {
      const dog = dogs.find((d) => d.id === dogId);
      if (!dog) continue;
      const miss = getMissingRequiredPetBookingFields({
        name: dog.name,
        species: dog.species,
        birth_date: dog.birth_date,
        microchip: dog.microchip,
        libretto_name: dog.libretto_name,
      });
      if (miss.length > 0) petMissing.push(`${dog.name}: ${miss.join(', ')}`);
    }
    if (petMissing.length > 0) {
      setMissingPetFields(petMissing);
      return;
    }

    try {
      const missingProfileFields = await loadMissingRequiredProfileFields();
      if (missingProfileFields.length > 0) {
        setMissingRequiredFields(missingProfileFields);
        return;
      }
    } catch (profileError) {
      return setError(
        humanizeErrorMessage(profileError, 'Non siamo riusciti a verificare i dati del profilo.')
      );
    }

    setSaving(true);

    try {
      if (taxiOption !== 'NONE' && taxiServiceAddressDirty) {
        await updateProfileForCurrentUser({
          dog_address_line: taxiServiceAddress.dog_address_line || null,
          dog_city: taxiServiceAddress.dog_city || null,
          dog_zip_code: taxiServiceAddress.dog_zip_code || null,
          dog_province: taxiServiceAddress.dog_province || null,
        });
        setTaxiServiceAddressDirty(false);
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setSaving(false);
        router.push('/login');
        return;
      }

      const result = await savePensioneBooking({
        bookingId: editingBookingId,
        startDate,
        endDate,
        arrivalTime,
        departureTime,
        notes,
        taxiOption,
        taxiDistanceBand,
        selectedDogIds: effectiveSelectedDogIds,
        perDogForm,
      });

      setEditingBookingId(result.bookingId);
      clearBookingDraft(draftKey);
      setSaving(false);
      router.push('/services');
    } catch (e) {
      console.error(e);
      setSaving(false);
      const message = humanizeErrorMessage(
        e,
        'Non siamo riusciti a salvare la prenotazione. Riprova.'
      );
      setError(message);
      if (/devi compilare:/i.test(message)) {
        try {
          setMissingRequiredFields(await loadMissingRequiredProfileFields());
        } catch {}
      }
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
    taxiServiceAddress,
    taxiServiceAddressDirty,
    pricing,
    perDogForm,
    notes,
    editingBookingId,
    draftKey,
    loadMissingRequiredProfileFields,
    router,
  ]);

  const handleRequiredProfileSaved = useCallback(async () => {
    const missing = await loadMissingRequiredProfileFields();
    setMissingRequiredFields(missing);
    if (missing.length === 0) {
      await submit();
    }
  }, [loadMissingRequiredProfileFields, submit]);

  const setStartDateChecked = useCallback((value: string) => {
    setStartDate(value);
    setArrivalTime((current) => normalizeSundayTime(current, value));
  }, []);

  const setEndDateChecked = useCallback((value: string) => {
    setEndDate(value);
    setDepartureTime((current) => normalizeSundayTime(current, value));
  }, []);

  const setArrivalTimeChecked = useCallback((value: string) => {
    setArrivalTime(normalizeSundayTime(value, startDate));
  }, [startDate]);

  const setDepartureTimeChecked = useCallback((value: string) => {
    setDepartureTime(normalizeSundayTime(value, endDate));
  }, [endDate]);

  return {
    loading: loading || loadingEdit,
    saving,
    error,
    missingRequiredFields,
    missingPetFields,

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
    taxiServiceAddress,
    showTaxiServiceAddressEditor:
      taxiServiceAddressDirty || !hasTaxiServiceAddressMinimum(taxiServiceAddress),

    notes,

    perDogForm,

    daysCount,
    pricing,

    setStartDate: setStartDateChecked,
    setEndDate: setEndDateChecked,
    setArrivalTime: setArrivalTimeChecked,
    setDepartureTime: setDepartureTimeChecked,

    setTaxiOption,
    updateTaxiServiceAddressField,
    setNotes,

    toggleDogSelection,
    updatePerDogField,

    editingBookingId,
    handleCancelEdit,
    handleRequiredProfileSaved,
    submit,
    setError,
  };
}
