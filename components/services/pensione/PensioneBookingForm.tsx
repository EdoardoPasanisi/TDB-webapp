// components/services/pensione/PensioneBookingForm.tsx
'use client';

import { useEffect, useState } from 'react';
import type { AccommodationKey, TaxiOption } from '@/types/booking';
import type { DogLite, PerDogForm, PensionePricing } from '@/lib/services/pensione/types';
import { ACCOMMODATION_PRICES, accommodationOptionsForSpecies } from '@/lib/services/pensione/constants';
import { computeGroomingPriceForDog, isSundayDate } from '@/lib/services/pensione/utils';
import { DogAvatar } from '@/components/dogs/DogAvatar';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import type { AddressSearchApiResponse, AddressSuggestion } from '@/lib/address/addressSearch';
import { TaxiQuote } from '@/components/services/common/TaxiQuote';
import { RequiredBookingProfileCard } from '@/components/services/common/RequiredBookingProfileCard';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';

const ADDRESS_SEARCH_MIN_CHARS = 3;
const ADDRESS_SEARCH_DEBOUNCE_MS = 350;

type Props = {
  title: string;
  error: string | null;
  blockedMessage?: string | null;
  missingRequiredFields: string[];
  missingPetFields: string[];
  saving: boolean;

  dogs: DogLite[];
  isSingleDog: boolean;
  selectedDogIds: string[];

  startDate: string;
  endDate: string;
  arrivalTime: string;
  departureTime: string;

  taxiOption: TaxiOption;

  taxiDistanceBand: 'ENTRO_40' | 'OLTRE_40';
  taxiDistance: { loading: boolean; error: string | null; km: number | null; approx: boolean };
  taxiServiceAddress: {
    dog_address_line: string;
    dog_city: string;
    dog_zip_code: string;
    dog_province: string;
  };
  showTaxiServiceAddressEditor: boolean;

  notes: string;

  perDogForm: Record<string, PerDogForm>;

  daysCount: number;
  pricing: PensionePricing;

  onToggleDog: (dogId: string) => void;

  onChangeStartDate: (v: string) => void;
  onChangeEndDate: (v: string) => void;
  onChangeArrivalTime: (v: string) => void;
  onChangeDepartureTime: (v: string) => void;

  onChangeTaxiOption: (v: TaxiOption) => void;
  onChangeTaxiServiceAddressField: (
    field: 'dog_address_line' | 'dog_city' | 'dog_zip_code' | 'dog_province',
    value: string
  ) => void;

  onChangeNotes: (v: string) => void;

  onUpdatePerDogField: (dogId: string, field: keyof PerDogForm, value: boolean | number | string) => void;

  onCancelEdit: () => void;
  onCompleteRequiredProfile: () => void | Promise<void>;
  onSubmit: () => void;
  showCancelEdit: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function formatAddressLine(
  addressLine?: string | null,
  zipCode?: string | null,
  city?: string | null,
  province?: string | null
) {
  const parts: string[] = [];
  if (addressLine) parts.push(addressLine);
  const cityLine = [zipCode, city].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);
  if (province) parts.push(`(${province})`);
  return parts.join(', ');
}

function SelectCard({
  title,
  subtitle,
  selected,
  onClick,
  right,
}: {
  title: string;
  subtitle?: string | null;
  selected: boolean;
  onClick: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('ui-selectCard ui-minw0', selected && 'ui-selectCard--selected')}
    >
      <div className="flex items-start justify-between gap-3 ui-minw0">
        <div className="ui-minw0">
          <div className="ui-body font-[var(--font-weight-semibold)] ui-minw0">{title}</div>
          {subtitle ? <div className="ui-muted mt-1 ui-minw0">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </button>
  );
}

function Stepper({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string;
  hint?: string | null;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="ui-stepper ui-minw0">
      <div className="flex items-center justify-between gap-3 ui-minw0">
        <div className="ui-minw0">
          <div className="ui-body font-[var(--font-weight-semibold)]">{label}</div>
          {hint ? <div className="ui-muted mt-1">{hint}</div> : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="ui-stepperBtn"
            onClick={() => onChange(Math.max(min, value - 1))}
            aria-label="Diminuisci"
          >
            −
          </button>

          <div className="ui-stepperValue ui-body">{value}</div>

          <button
            type="button"
            className="ui-stepperBtn"
            onClick={() => onChange(Math.min(max, value + 1))}
            aria-label="Aumenta"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export function PensioneBookingForm(props: Props) {
  const {
    title,
    error,
    blockedMessage,
    missingRequiredFields,
    missingPetFields,
    saving,
    dogs,
    isSingleDog,
    selectedDogIds,
    startDate,
    endDate,
    arrivalTime,
    departureTime,
    taxiOption,
    taxiDistance,
    taxiServiceAddress,
    showTaxiServiceAddressEditor,
    notes,
    perDogForm,
    daysCount,
    pricing,
    onToggleDog,
    onChangeStartDate,
    onChangeEndDate,
    onChangeArrivalTime,
    onChangeDepartureTime,
    onChangeTaxiOption,
    onChangeTaxiServiceAddressField,
    onChangeNotes,
    onUpdatePerDogField,
    onCancelEdit,
    onCompleteRequiredProfile,
    onSubmit,
    showCancelEdit,
  } = props;

  const startIsSunday = isSundayDate(startDate);
  const endIsSunday = isSundayDate(endDate);
  const taxiServiceAddressReady =
    taxiServiceAddress.dog_address_line.trim().length > 0 &&
    taxiServiceAddress.dog_city.trim().length > 0;
  const taxiServiceAddressPreview = formatAddressLine(
    taxiServiceAddress.dog_address_line,
    taxiServiceAddress.dog_zip_code,
    taxiServiceAddress.dog_city,
    taxiServiceAddress.dog_province
  );
  const [addressInputFocused, setAddressInputFocused] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);
  const debouncedAddressQuery = useDebouncedValue(
    taxiServiceAddress.dog_address_line,
    ADDRESS_SEARCH_DEBOUNCE_MS
  );

  useEffect(() => {
    const query = debouncedAddressQuery.trim();

    if (taxiOption === 'NONE' || !showTaxiServiceAddressEditor || !addressInputFocused) {
      setAddressSuggestions([]);
      setAddressSearchLoading(false);
      setAddressSearchError(null);
      return;
    }

    if (query.length < ADDRESS_SEARCH_MIN_CHARS) {
      setAddressSuggestions([]);
      setAddressSearchLoading(false);
      setAddressSearchError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setAddressSearchLoading(true);
      setAddressSearchError(null);

      try {
        const response = await fetch(`/api/address-search?q=${encodeURIComponent(query)}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => null)) as AddressSearchApiResponse | null;

        if (!response.ok || !json?.ok) {
          throw new Error(
            json && !json.ok && json.error
              ? json.error
              : 'Ricerca indirizzo non disponibile in questo momento.'
          );
        }

        if (cancelled) return;
        setAddressSuggestions(json.items);
      } catch (error) {
        if (controller.signal.aborted || cancelled) return;
        setAddressSuggestions([]);
        setAddressSearchError(
          error instanceof Error && error.message
            ? error.message
            : 'Ricerca indirizzo non disponibile in questo momento.'
        );
      } finally {
        if (!cancelled) setAddressSearchLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [addressInputFocused, debouncedAddressQuery, showTaxiServiceAddressEditor, taxiOption]);

  const handleSelectAddressSuggestion = (suggestion: AddressSuggestion) => {
    onChangeTaxiServiceAddressField('dog_address_line', suggestion.dog_address_line);
    onChangeTaxiServiceAddressField('dog_city', suggestion.dog_city);
    onChangeTaxiServiceAddressField('dog_zip_code', suggestion.dog_zip_code);
    onChangeTaxiServiceAddressField('dog_province', suggestion.dog_province);
    setAddressSuggestions([]);
    setAddressSearchError(null);
    setAddressInputFocused(false);
  };

  const hasMissingBookingFields = missingRequiredFields.length > 0 || missingPetFields.length > 0;

  return (
    <div className="ui-container space-y-4 ui-minw0">
      <div className="space-y-2 ui-minw0">
        <h1 className="ui-title ui-minw0">{title}</h1>
      </div>

      {hasMissingBookingFields ? (
        <div className="ui-alertWarn">
          <p className="ui-body font-[var(--font-weight-semibold)]">
            Non puoi completare la prenotazione senza alcuni dati obbligatori.
          </p>
          <p className="ui-muted mt-1">
            Puoi comunque continuare per vedere il preventivo: completa i dati mancanti qui sotto per poter prenotare.
          </p>
          <div className="mt-3 space-y-2">
            {missingRequiredFields.length ? (
              <div>
                <p className="ui-fine font-[var(--font-weight-semibold)]">Profilo</p>
                <ul className="ui-muted mt-1 list-disc pl-5">
                  {missingRequiredFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {missingPetFields.length ? (
              <div>
                <p className="ui-fine font-[var(--font-weight-semibold)]">Pet</p>
                <ul className="ui-muted mt-1 list-disc pl-5">
                  {missingPetFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {missingRequiredFields.length ? (
        <RequiredBookingProfileCard
          missingFields={missingRequiredFields}
          onSaved={() => onCompleteRequiredProfile()}
        />
      ) : null}

      {missingPetFields.length ? (
        <Card>
          <CardContent className="space-y-2 ui-minw0">
            <div className="ui-body font-[var(--font-weight-semibold)]">Dati pet da completare</div>
            <ul className="ui-muted list-disc pl-5">
              {missingPetFields.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
            <p className="ui-muted">
              Vai su <strong>Profilo → I miei pet</strong>, apri il pet e completa i dati mancanti.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {dogs.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 ui-minw0">
            <div className="ui-h2">Pet</div>
            <p className="ui-body ui-accentText font-[var(--font-weight-semibold)]">
              Non hai ancora aggiunto nessun pet al tuo profilo.
            </p>
            <p className="ui-muted">
              Vai alla sezione <strong>Profilo → I miei pet</strong> e aggiungi almeno un pet per poter effettuare una prenotazione.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!isSingleDog && dogs.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 ui-minw0">
            <div className="ui-minw0">
              <div className="ui-h2">Pet</div>
              <div className="ui-muted mt-1">Tocca per selezionare.</div>
            </div>

            <div className="grid grid-cols-1 gap-2 ui-minw0">
              {dogs.map((dog) => {
                const selected = selectedDogIds.includes(dog.id);

                return (
                  <button
                    key={dog.id}
                    type="button"
                    onClick={() => onToggleDog(dog.id)}
                    className={cx('ui-selectCard ui-minw0', selected && 'ui-selectCard--selected')}
                  >
                    <div className="flex items-center justify-between gap-3 ui-minw0">
                      <div className="flex items-center gap-3 ui-minw0">
                        <DogAvatar
                          photoPath={dog.photo_path ?? null}
                          updatedAt={dog.updated_at ?? null}
                          alt={dog.name}
                          size={36}
                        />
                        <div className="ui-minw0">
                          <div className="ui-body font-[var(--font-weight-semibold)] truncate">{dog.name}</div>
                          <div className="ui-muted mt-1 truncate">
                            Tocca per {selected ? 'deselezionare' : 'selezionare'}
                          </div>
                        </div>
                      </div>

                      <div className={cx('ui-pill', selected && 'ui-pill--selected')}>
                        {selected ? 'Selezionato' : 'Seleziona'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedDogIds.length === 0 ? (
              <div className="ui-body font-[var(--font-weight-semibold)] ui-accentText">
                Seleziona almeno un pet per continuare.
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 ui-minw0">
          <div className="ui-h2">Dettagli prenotazione</div>

          <div className="grid grid-cols-1 gap-6 ui-minw0">
            <Field label="Data inizio *" className="ui-minw0">
              <input
                type="date"
                value={startDate}
                onChange={(e) => onChangeStartDate(e.target.value)}
                className="ui-control ui-input ui-minw0"
              />
            </Field>

            <Field label="Data fine *" className="ui-minw0">
              <input
                type="date"
                value={endDate}
                onChange={(e) => onChangeEndDate(e.target.value)}
                className="ui-control ui-input ui-minw0"
              />
            </Field>

            {blockedMessage ? (
              <div className="ui-alertWarn">
                <p className="ui-body font-[var(--font-weight-semibold)]">{blockedMessage}</p>
              </div>
            ) : null}

            <Field
              label="Orario di arrivo (indicativo)"
              className="ui-minw0"
              hint={startIsSunday ? 'Di domenica è possibile solo tra le 9–13.' : 'Possibile tra le 9–13 o le 15–18.'}
            >
              <input
                type="time"
                value={arrivalTime}
                onChange={(e) => onChangeArrivalTime(e.target.value)}
                className="ui-control ui-input ui-minw0"
              />
            </Field>

            <Field
              label="Orario di partenza (indicativo, richiesto)"
              className="ui-minw0"
              hint={
                endIsSunday
                  ? 'Di domenica è possibile solo tra le 9–13. Entro le 13:00 non si conta il giorno di partenza.'
                  : '9–13: non si conta il giorno di partenza.\n 15–18: si conta anche il giorno di partenza.'
              }
            >
              <input
                type="time"
                value={departureTime}
                onChange={(e) => onChangeDepartureTime(e.target.value)}
                className="ui-control ui-input ui-minw0"
              />
            </Field>

            <Field
              label="Servizio taxi dog"
              hint={taxiOption !== 'NONE' ? 'Andata = orario di arrivo\nRitorno = orario di partenza' : null}
            >
              <select
                value={taxiOption}
                onChange={(e) => onChangeTaxiOption(e.target.value as TaxiOption)}
                className="ui-control ui-select"
              >
                <option value="NONE">No taxi dog</option>
                <option value="ONE_WAY">Solo andata</option>
                <option value="RETURN_ONLY">Solo ritorno</option>
                <option value="ROUND_TRIP">Andata e ritorno</option>
              </select>
            </Field>

            {taxiOption !== 'NONE' ? (
              <div className="ui-panelInset p-3 space-y-3">
                <div className="space-y-1">
                  <div className="ui-body font-[var(--font-weight-semibold)]">Indirizzo servizi</div>
                  <div className="ui-muted">
                    È l’indirizzo usato per calcolare il taxi dog.
                  </div>
                </div>

                {!showTaxiServiceAddressEditor && taxiServiceAddressReady ? (
                  <div className="ui-body">{taxiServiceAddressPreview}</div>
                ) : (
                  <>
                    <div className="ui-dangerText">
                      Inserisci qui l’indirizzo servizi per usare il taxi dog.
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="ui-label">Via / indirizzo</label>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={taxiServiceAddress.dog_address_line}
                            onChange={(e) => onChangeTaxiServiceAddressField('dog_address_line', e.target.value)}
                            onFocus={() => setAddressInputFocused(true)}
                            onBlur={() => {
                              window.setTimeout(() => setAddressInputFocused(false), 120);
                            }}
                            className="ui-control ui-input"
                            placeholder="Inizia a scrivere la via"
                            autoComplete="off"
                          />

                          {addressInputFocused &&
                          taxiServiceAddress.dog_address_line.trim().length >= ADDRESS_SEARCH_MIN_CHARS ? (
                            <div className="ui-panelInset overflow-hidden">
                              {addressSearchLoading ? (
                                <div className="px-3 py-2 ui-muted">Sto cercando l’indirizzo…</div>
                              ) : addressSearchError ? (
                                <div className="px-3 py-2 ui-dangerText">{addressSearchError}</div>
                              ) : addressSuggestions.length > 0 ? (
                                <div className="divide-y divide-[rgba(255,255,255,0.08)]">
                                  {addressSuggestions.map((suggestion) => (
                                    <button
                                      key={[
                                        suggestion.dog_address_line,
                                        suggestion.dog_city,
                                        suggestion.dog_zip_code,
                                        suggestion.dog_province,
                                      ].join('|')}
                                      type="button"
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => handleSelectAddressSuggestion(suggestion)}
                                      className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-[rgba(255,130,0,0.08)]"
                                    >
                                      <div className="space-y-1">
                                        <div className="ui-body font-[var(--font-weight-semibold)]">
                                          {suggestion.dog_address_line}
                                        </div>
                                        <div className="ui-muted">{suggestion.label}</div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="px-3 py-2 ui-muted">
                                  Nessun indirizzo trovato. Puoi continuare a compilarlo a mano.
                                </div>
                              )}
                            </div>
                          ) : null}

                          <div className="ui-muted">
                            Seleziona un suggerimento per compilare automaticamente città, CAP e provincia.
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="ui-label">Città</label>
                        <input
                          type="text"
                          value={taxiServiceAddress.dog_city}
                          onChange={(e) => onChangeTaxiServiceAddressField('dog_city', e.target.value)}
                          className="ui-control ui-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="ui-label">CAP</label>
                        <input
                          type="text"
                          value={taxiServiceAddress.dog_zip_code}
                          onChange={(e) => onChangeTaxiServiceAddressField('dog_zip_code', e.target.value)}
                          className="ui-control ui-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="ui-label">Provincia</label>
                        <input
                          type="text"
                          value={taxiServiceAddress.dog_province}
                          onChange={(e) => onChangeTaxiServiceAddressField('dog_province', e.target.value)}
                          className="ui-control ui-input"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            <Field label="Distanza taxi dog (automatica)" hint="Basata sull’indirizzo servizi attuale.">
              {taxiOption === 'NONE' ? (
                <div className="ui-muted">Non richiesta.</div>
              ) : taxiDistance.loading ? (
                <div className="ui-muted">Calcolo distanza in corso…</div>
              ) : taxiDistance.error ? (
                <div className="ui-dangerText">{taxiDistance.error}</div>
              ) : taxiDistance.approx ? (
                <div className="space-y-1">
                  <div className="ui-body font-[var(--font-weight-semibold)]">~ {pricing.taxiPrice}€ (tariffa massima)</div>
                  <div className="ui-muted">
                    Non siamo riusciti a calcolare la distanza esatta: applichiamo la tariffa massima. Verrà verificata e, se la
                    distanza è inferiore, il costo sarà ridotto. Puoi comunque procedere con la prenotazione.
                  </div>
                </div>
              ) : (
                taxiDistance.km !== null ? <TaxiQuote km={taxiDistance.km} priceEur={pricing.taxiPrice} /> : <div className="ui-muted">—</div>
              )}
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 ui-minw0">
          <div className="ui-h2">Alloggio ed extra per pet</div>

          <div className="space-y-4 ui-minw0">
	            {selectedDogIds.map((dogId) => {
	              const dog = dogs.find((d) => d.id === dogId);
	              const form = perDogForm[dogId];
	              if (!dog || !form) return null;

	              const groomingPrice = computeGroomingPriceForDog(dog);
	              const therapyMissing = form.therapy === '';
	              const accommodation = ACCOMMODATION_PRICES[form.accommodationType];

	              return (
	                <div key={dogId} className="ui-card p-4 space-y-4 ui-minw0">
                  <div className="flex items-center gap-3 ui-minw0">
                    <DogAvatar photoPath={dog.photo_path ?? null} updatedAt={dog.updated_at ?? null} alt={dog.name} size={40} />
	                    <div className="ui-minw0">
	                      <div className="ui-h2 truncate">{dog.name}</div>
	                      <div className="ui-muted truncate">
	                        {accommodation?.label ?? 'Seleziona alloggio'}
	                      </div>
	                    </div>
	                  </div>

	                  <Field label="Alloggio *">
	                    <select
	                      value={form.accommodationType}
	                      onChange={(e) =>
	                        onUpdatePerDogField(dogId, 'accommodationType', e.target.value as AccommodationKey)
	                      }
	                      className="ui-control ui-select"
	                    >
	                      {(Object.entries(ACCOMMODATION_PRICES) as Array<
	                        [AccommodationKey, { label: string; pricePerDay: number }]
	                      >)
	                        .filter(([key]) => accommodationOptionsForSpecies(dog.species ?? 'DOG').includes(key))
	                        .map(([key, info]) => (
	                          <option key={key} value={key}>
	                            {info.label} — {info.pricePerDay}€/giorno (1 cane)
	                          </option>
	                        ))}
	                    </select>
	                  </Field>

                  {/* ✅ NO CHECKBOX: solo card selezionabili */}
                  <div className="space-y-2 ui-minw0">
                    <div className="ui-body font-[var(--font-weight-semibold)]">Servizi extra</div>
                    <div className="grid grid-cols-1 gap-2 ui-minw0">
                      <SelectCard
                        title={`Toelettatura (+${groomingPrice}€)`}
                        subtitle="Servizio extra su richiesta"
                        selected={Boolean(perDogForm[dogId]?.grooming)}
                        onClick={() => {
                          const current = Boolean(perDogForm[dogId]?.grooming);
                          onUpdatePerDogField(dogId, 'grooming', !current);
                        }}
                      />

                      <SelectCard
                        title="Richiamo vaccinazione (+70€)"
                        subtitle="Se necessario durante il soggiorno"
                        selected={Boolean(perDogForm[dogId]?.vaccine)}
                        onClick={() => {
                          const current = Boolean(perDogForm[dogId]?.vaccine);
                          onUpdatePerDogField(dogId, 'vaccine', !current);
                        }}
                      />
                    </div>
                  </div>

                  {/* ✅ Attività: stepper mobile-friendly */}
                  <div className="space-y-2 ui-minw0">
                    <div className="ui-body font-[var(--font-weight-semibold)]">Attività</div>
                    <div className="grid grid-cols-1 gap-2 ui-minw0">
                      <Stepper
                        label="Ricerca olfattiva"
                        hint="20€ / 15 min"
                        value={form.trackingSessions}
                        onChange={(v) => onUpdatePerDogField(dogId, 'trackingSessions', v)}
                      />
                      <Stepper
                        label="Dog Fitness"
                        hint="25€ / 30 min"
                        value={form.fitnessSessions}
                        onChange={(v) => onUpdatePerDogField(dogId, 'fitnessSessions', v)}
                      />
                      <Stepper
                        label="Passeggiata nel bosco"
                        hint="15€ / 15 min"
                        value={form.walkSessions}
                        onChange={(v) => onUpdatePerDogField(dogId, 'walkSessions', v)}
                      />
                      <Stepper
                        label="Trekking in campagna"
                        hint="30€ / 45 min"
                        value={form.trekkingSessions}
                        onChange={(v) => onUpdatePerDogField(dogId, 'trekkingSessions', v)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 ui-minw0">
                    <div className="flex items-center justify-between gap-3 ui-minw0">
                      <div className="ui-body font-[var(--font-weight-semibold)]">Terapia in corso *</div>
                      {therapyMissing ? (
                        <div className="ui-body font-[var(--font-weight-semibold)] ui-dangerText">
                          Seleziona Sì o No
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2 ui-minw0">
                      <SelectCard
                        title="No"
                        subtitle="Nessuna terapia"
                        selected={form.therapy === 'NO'}
                        onClick={() => onUpdatePerDogField(dogId, 'therapy', 'NO')}
                      />
                      <SelectCard
                        title="Sì"
                        subtitle="Inserisci dettagli"
                        selected={form.therapy === 'YES'}
                        onClick={() => onUpdatePerDogField(dogId, 'therapy', 'YES')}
                      />
                    </div>

                    {form.therapy === 'YES' ? (
                      <div className="pt-2 ui-minw0">
                        <Field label="Dettagli terapia (farmaco, dosi, orari…) *">
                          <textarea
                            value={form.therapyNotes}
                            onChange={(e) => onUpdatePerDogField(dogId, 'therapyNotes', e.target.value)}
                            className="ui-control ui-textarea"
                            rows={3}
                          />
                        </Field>
                        {!form.therapyNotes.trim() ? (
                          <div className="ui-dangerText">
                            Se hai selezionato “Sì”, inserisci i dettagli della terapia.
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 ui-minw0">
          <div className="ui-h2">Note generali</div>
          <Field label="Note per la struttura">
            <textarea
              value={notes}
              onChange={(e) => onChangeNotes(e.target.value)}
              className="ui-control ui-textarea"
              rows={4}
              placeholder="Es. orari preferiti, esigenze particolari…"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 ui-minw0">
          <div className="ui-h2">Riepilogo</div>

          <div className="space-y-1 ui-body ui-minw0">
            <div>
              Giorni di permanenza:{' '}
              <span className="font-[var(--font-weight-semibold)]">{daysCount > 0 ? daysCount : '-'}</span>
            </div>
            <div>
              Pet inclusi: <span className="font-[var(--font-weight-semibold)]">{pricing.dogsCount}</span>
            </div>
            <div>
              Totale alloggi:{' '}
              <span className="font-[var(--font-weight-semibold)]">{pricing.alloggioTotalDiscounted.toFixed(2)}€</span>
            </div>
            <div>
              Totale extra (incluso taxi):{' '}
              <span className="font-[var(--font-weight-semibold)]">{pricing.extrasTotal.toFixed(2)}€</span>
            </div>
            <div className="pt-2 ui-h2">
              Totale preventivo:{' '}
              <span className="ui-accentText font-[var(--font-weight-bold)]">
                {pricing.totalPrice.toFixed(2)}€
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {showCancelEdit ? (
              <Button variant="secondary" fullWidth onClick={onCancelEdit}>
                Annulla modifiche
              </Button>
            ) : null}

            <Button
              variant="primary"
              fullWidth
              onClick={onSubmit}
              disabled={saving || Boolean(blockedMessage)}
            >
              {saving ? 'Salvataggio…' : showCancelEdit ? 'Salva modifiche' : 'Crea prenotazione'}
            </Button>

            {error ? <div className="ui-error">{error}</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
