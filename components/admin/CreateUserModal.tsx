'use client';

import { useState } from 'react';
import { fetchAdminJson } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { ModalFrame } from '@/components/admin/shared';
import { EMPTY_PROFILE_FORM, buildProfilePayload } from '@/components/admin/shared';
import type { ProfileFormState } from '@/types/forms';

type CreatedResult = { userId: string; tempPassword: string | null };

const TEXT_FIELDS: Array<{ key: keyof ProfileFormState; label: string; placeholder?: string }> = [
  { key: 'first_name', label: 'Nome' },
  { key: 'last_name', label: 'Cognome' },
  { key: 'phone', label: 'Telefono' },
  { key: 'fiscal_code', label: 'Codice fiscale' },
  { key: 'address_line', label: 'Indirizzo' },
  { key: 'city', label: 'Città' },
  { key: 'zip_code', label: 'CAP' },
  { key: 'province', label: 'Provincia' },
];

export function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (userId: string) => void | Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState<ProfileFormState>({ ...EMPTY_PROFILE_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedResult | null>(null);

  const reset = () => {
    setEmail('');
    setPassword('');
    setForm({ ...EMPTY_PROFILE_FORM });
    setError(null);
    setCreated(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const setField = (key: keyof ProfileFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        email: email.trim(),
        password: password.trim() || undefined,
        ...buildProfilePayload({ ...form, dog_address_same_as_home: true }, null),
      };
      const result = await fetchAdminJson<CreatedResult>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setCreated(result);
      await onCreated(result.userId);
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a creare l’utente.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalFrame open={open} title="Nuovo cliente" onClose={handleClose}>
      {created ? (
        <div className="space-y-4">
          <div className="ui-body">Cliente creato correttamente.</div>
          {created.tempPassword ? (
            <div className="ui-panelInset p-4 space-y-2">
              <div className="ui-body font-[var(--font-weight-semibold)]">Password temporanea</div>
              <div className="ui-body font-mono text-lg">{created.tempPassword}</div>
              <div className="ui-muted">
                Comunicala al cliente: la userà per il primo accesso (consigliato cambiarla poi dall’app).
              </div>
            </div>
          ) : (
            <div className="ui-muted">L’utente userà la password che hai impostato.</div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="primary" onClick={handleClose}>
              Chiudi
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {error ? <div className="ui-error">{error}</div> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="ui-control ui-input"
                placeholder="cliente@email.it"
              />
            </Field>
            <Field label="Password temporanea" hint="Lascia vuoto per generarla automaticamente.">
              <input
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="ui-control ui-input"
                placeholder="min. 8 caratteri"
              />
            </Field>
            {TEXT_FIELDS.map((entry) => (
              <Field key={entry.key} label={entry.label}>
                <input
                  type="text"
                  value={String(form[entry.key] ?? '')}
                  onChange={(event) => setField(entry.key, event.target.value)}
                  className="ui-control ui-input"
                />
              </Field>
            ))}
            <Field label="Data di nascita">
              <input
                type="date"
                value={form.birth_date}
                onChange={(event) => setField('birth_date', event.target.value)}
                className="ui-control ui-input"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
              Annulla
            </Button>
            <Button type="button" variant="primary" onClick={() => void handleSubmit()} disabled={submitting || !email.trim()}>
              {submitting ? 'Creazione…' : 'Crea cliente'}
            </Button>
          </div>
        </div>
      )}
    </ModalFrame>
  );
}
