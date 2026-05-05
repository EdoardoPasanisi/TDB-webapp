'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { updateProfileForCurrentUser } from '@/lib/account/profileApi';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';

type RequiredProfileRow = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

export function RequiredBookingProfileCard({
  missingFields,
  onSaved,
}: {
  missingFields: string[];
  onSaved?: () => Promise<void> | void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          throw new Error('Sessione non valida. Effettua di nuovo il login.');
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone')
          .eq('user_id', userData.user.id)
          .maybeSingle();

        if (profileError) {
          throw new Error(humanizeErrorMessage(profileError, 'Non siamo riusciti a caricare i dati del profilo.'));
        }

        if (cancelled) return;

        const row = (profile ?? null) as RequiredProfileRow | null;
        setFirstName(row?.first_name ?? '');
        setLastName(row?.last_name ?? '');
        setPhone(row?.phone ?? '');
        setLoading(false);
      } catch (loadError) {
        if (cancelled) return;
        setError(getErrorMessage(loadError, 'Impossibile caricare i dati profilo.'));
        setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedFirstName || !normalizedLastName || !normalizedPhone) {
      setError('Compila nome, cognome e telefono per continuare.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateProfileForCurrentUser({
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        phone: normalizedPhone,
      });
      await onSaved?.();
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Impossibile salvare i dati richiesti.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <div className="ui-body font-[var(--font-weight-semibold)]">Completa i dati per prenotare</div>
          <div className="ui-muted mt-1">
            Mancano: {missingFields.join(', ')}.
          </div>
        </div>

        {loading ? <div className="ui-muted">Caricamento dati profilo…</div> : null}
        {error ? <div className="ui-error">{error}</div> : null}

        {!loading ? (
          <>
            <Field label="Nome" required id="booking-required-first-name">
              <input
                id="booking-required-first-name"
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="ui-control ui-input"
              />
            </Field>

            <Field label="Cognome" required id="booking-required-last-name">
              <input
                id="booking-required-last-name"
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="ui-control ui-input"
              />
            </Field>

            <Field label="Telefono" required id="booking-required-phone">
              <input
                id="booking-required-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="ui-control ui-input"
              />
            </Field>

            <Button type="button" fullWidth onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Salvataggio…' : 'Salva e continua'}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
