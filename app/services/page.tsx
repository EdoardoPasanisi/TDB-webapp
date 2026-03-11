// FILE: app/services/page.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';

import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

import { ServiceCards } from '@/components/services/ServiceCards';
import { ServicePassCards } from '@/components/services/ServicePassCards';
import { FissaDataModal } from '@/components/services/FissaDataModal';

import { getUserServicePasses, buildPassSummaries } from '@/lib/services/servicePassesApi';
import { getWalletDueEur } from '@/lib/wallet/walletApi';
import { euro } from '@/lib/services/formatters';

import { Card, CardContent } from '@/components/ui/Card';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function SaldoPill({ amount }: { amount: number }) {
  return (
    <div
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        border: '1px solid rgba(255,130,0,0.75)',
        background: 'rgba(255,130,0,0.08)',
        color: 'var(--text)',
      }}
    >
      Saldo: {euro(amount)}
    </div>
  );
}

export default function ServicesPage() {
  const { user, loading: authLoading, error: authError } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [passesState, setPassesState] = useState<LoadState>('idle');
  const [passesError, setPassesError] = useState<string | null>(null);
  const [passSummaries, setPassSummaries] = useState<ReturnType<typeof buildPassSummaries>>([]);

  const [fixDateOpen, setFixDateOpen] = useState(false);
  const [selectedPassGroupKey, setSelectedPassGroupKey] = useState<string | null>(null);

  const [walletState, setWalletState] = useState<LoadState>('idle');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletDue, setWalletDue] = useState<number>(0);

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

  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;

    let cancelled = false;

    async function run() {
      setWalletState('loading');
      setWalletError(null);

      try {
        const due = await getWalletDueEur(userId);
        if (cancelled) return;

        setWalletDue(due);
        setWalletState('ready');
      } catch (error) {
        console.error(error);
        if (cancelled) return;

        setWalletError(getErrorMessage(error, 'Errore caricamento wallet.'));
        setWalletState('error');
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
      <main className="min-h-screen flex items-center justify-center bg-[var(--brand-bg)]">
        <p className="text-sm text-[var(--muted)]">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  const anyError = authError?.message ?? passesError ?? walletError;

  return (
    <main className="min-h-screen bg-[var(--brand-bg)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-xl px-4 pb-8 pt-4 space-y-4">
        {anyError ? (
          <Card className="border border-red-500/30">
            <CardContent className="text-sm text-red-300">{anyError}</CardContent>
          </Card>
        ) : null}

        {/* ✅ SOLO saldo “pill” (niente card totale dovuto) */}
        {walletState !== 'loading' && walletDue > 0 ? <SaldoPill amount={walletDue} /> : null}

        <ServiceCards />

        {passesState === 'loading' ? (
          <Card>
            <CardContent className="text-sm text-[var(--muted)]">Caricamento crediti…</CardContent>
          </Card>
        ) : passSummaries.length > 0 ? (
          <ServicePassCards passes={passSummaries} onFixDate={handleFixDate} />
        ) : null}

        <FissaDataModal
          open={fixDateOpen}
          onClose={() => setFixDateOpen(false)}
          userId={user.id}
          pass={selectedPass}
          onBooked={async () => {
            try {
              const passes = await getUserServicePasses(user.id);
              setPassSummaries(buildPassSummaries(passes));
            } catch {}

            try {
              const due = await getWalletDueEur(user.id);
              setWalletDue(due);
            } catch {}
          }}
        />
      </div>
    </main>
  );
}
