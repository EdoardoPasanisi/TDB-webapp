'use client';

import { useEffect, useMemo, useState } from 'react';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { NotificationPreferences } from '@/types/notificationPreferences';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/account/notificationPreferencesApi';

type PreferenceKey = keyof Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>;

const NOTIFICATION_ROWS = [
  {
    label: 'Prenotazioni',
    subtitle: 'Conferme, annullamenti, spostamenti e aggiornamenti operativi sulla tua prenotazione.',
    inAppKey: 'booking_in_app',
    emailKey: 'booking_email',
  },
  {
    label: 'Documenti',
    subtitle: 'Accettazione, rifiuto o richiesta di nuovo caricamento di documenti e liberatoria.',
    inAppKey: 'document_in_app',
    emailKey: 'document_email',
  },
  {
    label: 'Chat',
    subtitle: 'Messaggi nuovi quando un operatore ti risponde nella conversazione.',
    inAppKey: 'chat_in_app',
    emailKey: 'chat_email',
  },
  {
    label: 'Media',
    subtitle: 'Nuove foto e nuovi video caricati durante la pensione.',
    inAppKey: 'media_in_app',
    emailKey: 'media_email',
  },
] as const satisfies Array<{
  label: string;
  subtitle: string;
  inAppKey: PreferenceKey;
  emailKey: PreferenceKey;
}>;

function ChannelToggle({
  label,
  value,
  disabled,
  unavailable = false,
  onToggle,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  unavailable?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`ui-notificationPrefToggle ${
        value ? 'ui-notificationPrefToggle--active' : 'ui-notificationPrefToggle--inactive'
      }`}
    >
      <div className="ui-body font-[var(--font-weight-semibold)]">{label}</div>
      <div className="ui-notificationPrefToggle__state">
        {unavailable ? 'Non disponibile ora' : value ? 'Attive' : 'Disattivate'}
      </div>
    </button>
  );
}

export function NotificationPreferencesPanel() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingPreferenceKey, setSavingPreferenceKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      try {
        const data = await fetchNotificationPreferences();
        if (!cancelled) setPreferences(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            humanizeErrorMessage(loadError, 'Non siamo riusciti a caricare le preferenze notifiche.')
          );
        }
      }
    }

    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTogglePreference(key: PreferenceKey, value: boolean) {
    if (!preferences) return;

    const previous = preferences;
    const next = { ...previous, [key]: value };
    setPreferences(next);
    setSavingPreferenceKey(key);
    setError(null);

    try {
      const updated = await updateNotificationPreferences({ [key]: value });
      setPreferences(updated);
    } catch (saveError) {
      setPreferences(previous);
      setError(
        humanizeErrorMessage(saveError, 'Non siamo riusciti a salvare le preferenze notifiche.')
      );
    } finally {
      setSavingPreferenceKey(null);
    }
  }

  const noteText = useMemo(
    () =>
      'Le notifiche vengono inviate solo quando succede davvero qualcosa sul tuo account o sulle tue prenotazioni. Mai marketing, promozioni o messaggi superflui.',
    []
  );

  return (
    <div className="space-y-4">
      <div className="ui-muted">{noteText}</div>

      {error ? <div className="ui-error">{error}</div> : null}

      {preferences ? (
        <div className="ui-notificationPrefsList">
          {NOTIFICATION_ROWS.map((row) => (
            <div key={row.label} className="ui-notificationPrefCard">
              <div className="space-y-1">
                <div className="ui-body font-[var(--font-weight-semibold)]">{row.label}</div>
                <div className="ui-muted">{row.subtitle}</div>
              </div>

              <div className="ui-notificationPrefChannels">
                <ChannelToggle
                  label="App"
                  value={preferences[row.inAppKey]}
                  disabled={savingPreferenceKey === row.inAppKey}
                  onToggle={() =>
                    void handleTogglePreference(row.inAppKey, !preferences[row.inAppKey])
                  }
                />
                <ChannelToggle
                  label="Email"
                  value={preferences[row.emailKey]}
                  disabled={savingPreferenceKey === row.emailKey}
                  onToggle={() =>
                    void handleTogglePreference(row.emailKey, !preferences[row.emailKey])
                  }
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ui-muted">Caricamento preferenze…</div>
      )}
    </div>
  );
}
