'use client';

import { useEffect, useState } from 'react';
import { ModalFrame } from '@/components/admin/shared';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { CreatePensioneBookingModal } from '@/components/admin/CreatePensioneBookingModal';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import type { AdminUserListItem } from '@/lib/admin/types';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Pulsante "Crea prenotazione" autonomo: apre un selettore cliente e poi la
 * modale di prenotazione pensione. Usato dalla tab Servizi del gestionale.
 */
export function CreatePensioneBookingLauncher({ onCreated }: { onCreated?: () => void | Promise<void> }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [candidates, setCandidates] = useState<AdminUserListItem[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<{ userId: string; name: string } | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const q = debouncedQuery.trim();
    const controller = new AbortController();

    const run = async () => {
      if (q.length < 2) {
        setCandidates([]);
        setSearchState('idle');
        return;
      }
      setSearchState('loading');
      setError(null);
      try {
        const payload = await fetchAdminJson<{ items: AdminUserListItem[] }>(
          `/api/admin/users?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        setCandidates(payload.items);
        setSearchState('ready');
      } catch (err) {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a cercare i clienti.'));
        setSearchState('error');
      }
    };

    void run();

    return () => controller.abort();
  }, [pickerOpen, debouncedQuery]);

  const openPicker = () => {
    setQuery('');
    setCandidates([]);
    setSearchState('idle');
    setError(null);
    setPickerOpen(true);
  };

  return (
    <>
      <Button variant="primary" className="ui-btnCompact" onClick={openPicker}>
        Crea prenotazione
      </Button>

      <ModalFrame
        open={pickerOpen}
        title="Crea prenotazione — scegli il cliente"
        onClose={() => setPickerOpen(false)}
        maxWidthClassName="sm:max-w-xl"
      >
        <div className="space-y-3">
          <Field label="Cerca cliente (nome, email, telefono)">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ui-control ui-input"
              placeholder="Inizia a scrivere…"
              autoFocus
            />
          </Field>

          {error ? <div className="ui-error">{error}</div> : null}

          {searchState === 'loading' ? <div className="ui-muted">Ricerca in corso…</div> : null}

          {searchState === 'ready' && candidates.length === 0 ? (
            <div className="ui-muted">Nessun cliente trovato.</div>
          ) : null}

          <div className="space-y-2">
            {candidates.map((candidate) => (
              <button
                key={candidate.userId}
                type="button"
                className="ui-selectCard w-full text-left"
                onClick={() => {
                  setSelected({ userId: candidate.userId, name: candidate.fullName || 'Cliente' });
                  setPickerOpen(false);
                }}
              >
                <div className="ui-body font-[var(--font-weight-semibold)]">
                  {candidate.fullName || 'Cliente'}
                </div>
                <div className="ui-muted mt-1">
                  {[candidate.email, candidate.phone].filter(Boolean).join(' · ') || '—'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </ModalFrame>

      <CreatePensioneBookingModal
        open={Boolean(selected)}
        userId={selected?.userId ?? null}
        userName={selected?.name ?? 'Cliente'}
        onClose={() => setSelected(null)}
        onCreated={onCreated}
      />
    </>
  );
}
