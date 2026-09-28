// FILE: app/services/page.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';

import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { humanizeErrorMessage } from '@/lib/errors/humanize';

import { ServiceCards } from '@/components/services/ServiceCards';
import { ServicePassCards } from '@/components/services/ServicePassCards';
import { FissaDataModal } from '@/components/services/FissaDataModal';
import { BookingSuccessScreen } from '@/components/services/BookingSuccessScreen';

import {
  getUserServicePasses,
  buildPassSummaries,
  buildPendingPassSummaries,
} from '@/lib/services/servicePassesApi';

import { Card, CardContent } from '@/components/ui/Card';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

export default function ServicesPage() {
  const { user, loading: authLoading, error: authError } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [passesState, setPassesState] = useState<LoadState>('idle');
  const [passesError, setPassesError] = useState<string | null>(null);
  const [passSummaries, setPassSummaries] = useState<ReturnType<typeof buildPassSummaries>>([]);
  const [pendingPassSummaries, setPendingPassSummaries] = useState<
    ReturnType<typeof buildPendingPassSummaries>
  >([]);

  const [fixDateOpen, setFixDateOpen] = useState(false);
  const [bookingSuccessOpen, setBookingSuccessOpen] = useState(false);
  const [selectedPassGroupKey, setSelectedPassGroupKey] = useState<string | null>(null);

  const selectedPass = useMemo(
    () => passSummaries.find((p) => p.groupKey === selectedPassGroupKey) ?? null,
    [passSummaries, selectedPassGroupKey]
  );

  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;

    let cancelled = false;

    async function run() {
      setPassesState('loading');
      setPassesError(null);

      try {
        const passes = await getUserServicePasses(userId);
        if (cancelled) return;

        setPassSummaries(buildPassSummaries(passes));
        setPendingPassSummaries(buildPendingPassSummaries(passes));
        setPassesState('ready');
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setPassesError(getErrorMessage(error, 'Errore caricamento crediti.'));
        setPassesState('error');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function handleFixDate(passGroup: (typeof passSummaries)[number]) {
    setSelectedPassGroupKey(passGroup.groupKey);
    setFixDateOpen(true);
  }

  if (authLoading) {
    return (
      <main className="ui-page min-h-screen flex items-center justify-center">
        <p className="ui-muted">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  const anyError = authError ? humanizeErrorMessage(authError, 'Non siamo riusciti a verificare il tuo accesso.') : passesError;

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-xl px-4 pb-8 pt-4 space-y-4">
        {anyError ? (
          <div className="ui-error">{anyError}</div>
        ) : null}

        <ServiceCards />

        {passesState === 'loading' ? (
          <Card>
            <CardContent className="ui-muted">Caricamento crediti…</CardContent>
          </Card>
        ) : passSummaries.length > 0 || pendingPassSummaries.length > 0 ? (
          <ServicePassCards
            passes={passSummaries}
            pendingPasses={pendingPassSummaries}
            onFixDate={handleFixDate}
          />
        ) : null}

        <FissaDataModal
          open={fixDateOpen}
          onClose={() => setFixDateOpen(false)}
          userId={user.id}
          pass={selectedPass}
          onBooked={async () => {
            setBookingSuccessOpen(true);
            try {
              const passes = await getUserServicePasses(user.id);
              setPassSummaries(buildPassSummaries(passes));
              setPendingPassSummaries(buildPendingPassSummaries(passes));
            } catch {}

          }}
        />

        <BookingSuccessScreen
          open={bookingSuccessOpen}
          onClose={() => setBookingSuccessOpen(false)}
        />
      </div>
    </main>
  );
}
