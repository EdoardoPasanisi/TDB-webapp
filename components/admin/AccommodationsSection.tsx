'use client';

// Gestione alloggi pensione (Config → Alloggi e prezzi): aggiungi, modifica prezzi per
// 1/2/3+ cani, accendi/spegni la climatizzazione (supplemento automatico su tutte le
// prenotazioni di quell'alloggio) ed elimina. "Elimina" archivia: l'alloggio sparisce dalle
// prenotazioni nuove ma resta per quelle già fatte, che mantengono i prezzi salvati.

import { useEffect, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import {
  CLIMATE_DEFAULT_PRICE_PER_DAY,
  type Accommodation,
  type AccommodationCatalog,
  type AccommodationSpecies,
} from '@/lib/services/pensione/accommodations';
import { invalidateAccommodationCatalogCache } from '@/lib/services/pensione/hooks/useAccommodationCatalog';
import { useConfirm } from '@/components/admin/ConfirmProvider';
import { EmptyCard, ErrorCard, LoadingCard, cx, formatEuro, type LoadState } from '@/components/admin/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { SectionHeader } from '@/components/ui/SectionHeader';

type FormState = {
  key: string | null; // null = nuovo alloggio
  label: string;
  species: AccommodationSpecies;
  price1: string;
  price2: string;
  price3: string;
  climateActive: boolean;
  climatePrice: string;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  key: null,
  label: '',
  species: 'DOG',
  price1: '',
  price2: '',
  price3: '',
  climateActive: false,
  climatePrice: String(CLIMATE_DEFAULT_PRICE_PER_DAY),
  sortOrder: '100',
};

function formFromAccommodation(item: Accommodation): FormState {
  return {
    key: item.key,
    label: item.label,
    species: item.species,
    price1: String(item.tierPrices[0]),
    price2: String(item.tierPrices[1]),
    price3: String(item.tierPrices[2]),
    climateActive: item.climateActive,
    climatePrice: String(item.climatePricePerDay),
    sortOrder: String(item.sortOrder),
  };
}

function toNumber(value: string): number {
  return Number(String(value).replace(',', '.'));
}

/** Sconto implicito rispetto a N × prezzo per 1 cane, per aiutare a controllare i tier. */
function discountLabel(single: number, total: number, dogs: number): string | null {
  if (!(single > 0) || !(total > 0)) return null;
  const full = single * dogs;
  const pct = Math.round((1 - total / full) * 1000) / 10;
  const perDog = Math.round((total / dogs) * 100) / 100;
  return `${formatEuro(perDog)}/cane${pct > 0 ? ` · sconto ${pct}%` : ''}`;
}

export function AccommodationsSection() {
  const confirm = useConfirm();
  const [items, setItems] = useState<AccommodationCatalog>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = async (signal?: AbortSignal) => {
    setState('loading');
    try {
      const data = await fetchAdminJson<{ items: AccommodationCatalog }>('/api/admin/accommodations', { signal });
      setItems(data.items);
      setState('ready');
    } catch (err) {
      if (isAbortError(err)) return;
      setState('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  const afterChange = async () => {
    invalidateAccommodationCatalogCache();
    await load();
  };

  const save = async () => {
    if (!form) return;
    setError(null);

    const payload = {
      label: form.label.trim(),
      species: form.species,
      tierPrices: [toNumber(form.price1), toNumber(form.price2), toNumber(form.price3)],
      climateActive: form.climateActive,
      climatePricePerDay: toNumber(form.climatePrice),
      sortOrder: toNumber(form.sortOrder),
    };

    if (form.key) {
      const ok = await confirm({
        keyword: 'MODIFICA',
        title: `Modifica ${form.label}`,
        message:
          'I nuovi prezzi valgono per le prenotazioni create o modificate da ora. Le prenotazioni già salvate mantengono i loro importi.',
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      await fetchAdminJson(form.key ? `/api/admin/accommodations/${form.key}` : '/api/admin/accommodations', {
        method: form.key ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setForm(null);
      await afterChange();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare l’alloggio.'));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (item: Accommodation) => {
    const ok = await confirm({
      keyword: 'ELIMINA',
      title: `Elimina ${item.label}`,
      message:
        'L’alloggio non sarà più prenotabile. Le prenotazioni già fatte restano invariate e potrai ripristinarlo da “Mostra eliminati”.',
    });
    if (!ok) return;
    setError(null);
    try {
      await fetchAdminJson(`/api/admin/accommodations/${item.key}`, { method: 'DELETE' });
      if (form?.key === item.key) setForm(null);
      await afterChange();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a eliminare l’alloggio.'));
    }
  };

  const restore = async (item: Accommodation) => {
    setError(null);
    try {
      await fetchAdminJson(`/api/admin/accommodations/${item.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: true }),
      });
      await afterChange();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a ripristinare l’alloggio.'));
    }
  };

  // Interruttore generale: sovrascrive la climatizzazione di tutti gli alloggi.
  const bookable = items.filter((item) => item.active);
  const climateOnCount = bookable.filter((item) => item.climateActive).length;
  const allClimateOn = bookable.length > 0 && climateOnCount === bookable.length;
  const [togglingClimate, setTogglingClimate] = useState(false);

  const setClimateForAll = async (active: boolean) => {
    const ok = await confirm({
      keyword: 'MODIFICA',
      title: active ? 'Attiva la climatizzazione su tutti gli alloggi' : 'Disattiva la climatizzazione su tutti gli alloggi',
      message: active
        ? 'Il supplemento climatizzazione si applica a tutti gli alloggi, sostituendo le scelte dei singoli alloggi. Vale per le prenotazioni create o modificate da ora.'
        : 'Il supplemento climatizzazione viene tolto da tutti gli alloggi, sostituendo le scelte dei singoli alloggi. Le prenotazioni già salvate non cambiano.',
    });
    if (!ok) return;
    setTogglingClimate(true);
    setError(null);
    try {
      await fetchAdminJson('/api/admin/accommodations', {
        method: 'PATCH',
        body: JSON.stringify({ climateActive: active }),
      });
      await afterChange();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti ad aggiornare la climatizzazione.'));
    } finally {
      setTogglingClimate(false);
    }
  };

  const visible = items.filter((item) => showArchived || item.active);
  const archivedCount = items.filter((item) => !item.active).length;
  const price1 = form ? toNumber(form.price1) : 0;

  return (
    <Card>
      <CardContent className="space-y-3">
        <SectionHeader
          title="Alloggi e prezzi pensione"
          subtitle="Prezzo totale al giorno in base a quanti cani porta lo stesso cliente (lo sconto per più cani è già dentro). Con la climatizzazione attiva, ogni cane in quell’alloggio paga il supplemento al giorno: il cliente lo vede nel preventivo e non può toglierlo. Vale per le prenotazioni create o modificate mentre è attiva."
        />

        {error ? <div className="ui-error">{error}</div> : null}

        {state === 'ready' && bookable.length > 0 ? (
          <div className="ui-card flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="ui-body font-[var(--font-weight-semibold)]">Climatizzazione su tutti gli alloggi</div>
              <div className="ui-muted">
                {allClimateOn
                  ? 'Attiva su tutti gli alloggi.'
                  : climateOnCount === 0
                    ? 'Spenta su tutti gli alloggi.'
                    : `Attiva su ${climateOnCount} alloggi su ${bookable.length}.`}{' '}
                L’interruttore sovrascrive la scelta dei singoli alloggi.
              </div>
            </div>
            <label className="flex shrink-0 items-center gap-2 ui-body">
              <input
                type="checkbox"
                checked={allClimateOn}
                disabled={togglingClimate}
                onChange={(e) => void setClimateForAll(e.target.checked)}
              />
              {togglingClimate ? 'Aggiornamento…' : allClimateOn ? 'Attiva' : 'Spenta'}
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            className="ui-btnCompact"
            onClick={() => {
              setError(null);
              setForm({ ...EMPTY_FORM });
            }}
          >
            Aggiungi alloggio
          </Button>
          {archivedCount ? (
            <button
              type="button"
              onClick={() => setShowArchived((value) => !value)}
              className={cx('rounded-full px-3 py-1.5 ui-body ui-clickable', showArchived && 'ui-clickable--selected')}
            >
              Mostra eliminati ({archivedCount})
            </button>
          ) : null}
        </div>

        {form ? (
          <Card className="admin-listCard">
            <CardContent className="space-y-3">
              <div className="ui-body font-[var(--font-weight-semibold)]">
                {form.key ? `Modifica: ${form.label || 'alloggio'}` : 'Nuovo alloggio'}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    className="ui-control ui-input"
                    placeholder="Es. Box con giardino"
                  />
                </Field>
                <Field label="Per">
                  <select
                    value={form.species}
                    onChange={(e) => setForm({ ...form, species: e.target.value as AccommodationSpecies })}
                    className="ui-control ui-select"
                  >
                    <option value="DOG">Cani</option>
                    <option value="CAT">Gatti</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="1 cane (€/giorno)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={form.price1}
                    onChange={(e) => setForm({ ...form, price1: e.target.value })}
                    className="ui-control ui-input"
                  />
                </Field>
                <Field label="2 cani, totale (€/giorno)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={form.price2}
                    onChange={(e) => setForm({ ...form, price2: e.target.value })}
                    className="ui-control ui-input"
                  />
                  <div className="ui-muted text-xs">{discountLabel(price1, toNumber(form.price2), 2) ?? ' '}</div>
                </Field>
                <Field label="3+ cani, totale (€/giorno)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={form.price3}
                    onChange={(e) => setForm({ ...form, price3: e.target.value })}
                    className="ui-control ui-input"
                  />
                  <div className="ui-muted text-xs">{discountLabel(price1, toNumber(form.price3), 3) ?? ' '}</div>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 ui-body sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.climateActive}
                    onChange={(e) => setForm({ ...form, climateActive: e.target.checked })}
                  />
                  Climatizzazione attiva (supplemento su tutte le prenotazioni)
                </label>
                <Field label="Climatizzazione (€/giorno)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={form.climatePrice}
                    disabled={!form.climateActive}
                    onChange={(e) => setForm({ ...form, climatePrice: e.target.value })}
                    className="ui-control ui-input"
                  />
                </Field>
              </div>

              <Field label="Ordine nell’elenco (più basso = più in alto)">
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  className="ui-control ui-input sm:max-w-[160px]"
                />
              </Field>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" className="ui-btnCompact" onClick={() => setForm(null)} disabled={saving}>
                  Annulla
                </Button>
                <Button variant="primary" className="ui-btnCompact" onClick={() => void save()} disabled={saving}>
                  {saving ? 'Salvataggio…' : 'Salva'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {state === 'loading' ? (
          <LoadingCard label="Carico gli alloggi..." />
        ) : state === 'error' ? (
          <ErrorCard error="Non siamo riusciti a caricare gli alloggi." onRetry={() => void load()} />
        ) : visible.length === 0 ? (
          <EmptyCard label="Nessun alloggio configurato." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((item) => (
              <Card key={item.key} className="admin-listCard">
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="ui-body font-[var(--font-weight-semibold)] truncate">
                        {item.label}
                        {!item.active ? ' (eliminato)' : ''}
                      </div>
                      <div className="ui-muted">{item.species === 'CAT' ? 'Gatti' : 'Cani'}</div>
                    </div>
                    <span className="ui-accentPill shrink-0">{formatEuro(item.tierPrices[0])}/g</span>
                  </div>
                  <div className="ui-muted">
                    2 cani {formatEuro(item.tierPrices[1])} · 3+ cani {formatEuro(item.tierPrices[2])}
                  </div>
                  <div className="ui-muted">
                    Climatizzazione:{' '}
                    {item.climateActive ? `attiva, +${formatEuro(item.climatePricePerDay)}/giorno per cane` : 'spenta'}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.active ? (
                      <>
                        <Button
                          variant="secondary"
                          className="ui-btnCompact"
                          onClick={() => {
                            setError(null);
                            setForm(formFromAccommodation(item));
                          }}
                        >
                          Modifica
                        </Button>
                        <Button variant="secondary" className="ui-btnCompact" onClick={() => void archive(item)}>
                          Elimina
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" className="ui-btnCompact" onClick={() => void restore(item)}>
                        Ripristina
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
