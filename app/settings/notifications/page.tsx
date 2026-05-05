'use client';

import { NotificationPreferencesPanel } from '@/components/settings/NotificationPreferencesPanel';

export default function NotificationSettingsPage() {
  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-4 space-y-4">
        <header className="space-y-1">
          <h1 className="ui-title">Notifiche</h1>
          <p className="ui-muted">
            Decidi quali aggiornamenti ricevere e su quali canali.
          </p>
        </header>

        <NotificationPreferencesPanel />
      </div>
    </main>
  );
}
