// components/services/pensione/PensioneBookingForm.tsx
'use client';

import type { AccommodationKey, TaxiOption } from '@/types/booking';
import type { DogLite, PerDogForm, PensionePricing } from '@/lib/services/pensione/types';
import { ACCOMMODATION_PRICES } from '@/lib/services/pensione/constants';
import { computeGroomingPriceForDog } from '@/lib/services/pensione/utils';
import { DogAvatar } from '@/components/dogs/DogAvatar';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';

type Props = {
  title: string;
  error: string | null;
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
  taxiDistance: { loading: boolean; error: string | null; km: number | null };

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

  onChangeNotes: (v: string) => void;

  onUpdatePerDogField: (dogId: string, field: keyof PerDogForm, value: boolean | number | string) => void;

  onCancelEdit: () => void;
  onSubmit: () => void;
  showCancelEdit: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
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
    saving,
    dogs,
    isSingleDog,
    selectedDogIds,
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
    onToggleDog,
    onChangeStartDate,
    onChangeEndDate,
    onChangeArrivalTime,
    onChangeDepartureTime,
    onChangeTaxiOption,
    onChangeNotes,
    onUpdatePerDogField,
    onCancelEdit,
    onSubmit,
    showCancelEdit,
  } = props;

  return (
    <div className="ui-container space-y-4 ui-minw0">
      <div className="space-y-2 ui-minw0">
        <h1 className="ui-title ui-minw0">{title}</h1>
      </div>

      {error ? <div className="ui-error">{error}</div> : null}

      {!isSingleDog ? (
        <Card>
          <CardContent className="space-y-3 ui-minw0">
            <div className="ui-minw0">
              <div className="ui-h2">Cani</div>
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
              <div className="ui-body font-[var(--font-weight-semibold)] text-[var(--brand-accent)]">
                Seleziona almeno un cane per continuare.
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

            <Field
              label="Orario di arrivo (indicativo)"
              className="ui-minw0"
              hint="Possibile tra le 9–13 o le 15–18."
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
              hint={'9–13: non si conta il giorno di partenza.\n 15–18: si conta anche il giorno di partenza.'}
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

            <Field label="Distanza taxi dog (automatica)" hint="Basata sull’indirizzo taxi dog salvato nel profilo.">
              {taxiOption === 'NONE' ? (
                <div className="ui-muted">Non richiesta.</div>
              ) : taxiDistance.loading ? (
                <div className="ui-muted">Calcolo distanza in corso…</div>
              ) : taxiDistance.error ? (
                <div className="ui-body text-[rgba(255,0,0,0.85)]">{taxiDistance.error}</div>
              ) : (
                <div className="space-y-1 ui-body">
                  <div>
                    Distanza stimata:{' '}
                    <span className="font-[var(--font-weight-semibold)]">{taxiDistance.km?.toFixed(1)} km</span>
                  </div>
                  <div>
                    Fascia prezzo:{' '}
                    <span className="font-[var(--font-weight-semibold)]">
                      {taxiDistanceBand === 'ENTRO_40' ? 'Entro 40 km' : 'Oltre 40 km'}
                    </span>
                  </div>
                </div>
              )}
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 ui-minw0">
          <div className="ui-h2">Alloggio ed extra per cane</div>

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
	                      >).map(([key, info]) => (
	                          <option key={key} value={key}>
	                            {info.label} — {info.pricePerDay}€/giorno
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
                        label="Tracking"
                        hint="30€ / 45 min"
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
                    </div>
                  </div>

                  <div className="space-y-2 ui-minw0">
                    <div className="flex items-center justify-between gap-3 ui-minw0">
                      <div className="ui-body font-[var(--font-weight-semibold)]">Terapia in corso *</div>
                      {therapyMissing ? (
                        <div className="ui-body font-[var(--font-weight-semibold)] text-[rgba(255,0,0,0.85)]">
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
                        <Field label="Dettagli terapia (farmaco, dosi, orari…)">
                          <textarea
                            value={form.therapyNotes}
                            onChange={(e) => onUpdatePerDogField(dogId, 'therapyNotes', e.target.value)}
                            className="ui-control ui-textarea"
                            rows={3}
                          />
                        </Field>
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
              Cani inclusi: <span className="font-[var(--font-weight-semibold)]">{pricing.dogsCount}</span>
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
              <span className="text-[var(--brand-accent)] font-[var(--font-weight-bold)]">
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
              disabled={saving || pricing.totalPrice <= 0}
            >
              {saving ? 'Salvataggio…' : showCancelEdit ? 'Salva modifiche' : 'Crea prenotazione'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
