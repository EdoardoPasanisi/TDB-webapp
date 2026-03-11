'use client';

// app/account/waiver/page.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import type { Profile } from '@/types/profile';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

const COMPANY = {
  name: 'Tenuta del Barone',
  addressLine: 'Via Davide Passigli, 60',
  city: 'Palidoro',
  vatLabel: 'P.IVA: 08804121005',
};

// Logo opzionale: se non esiste in /public, sparisce senza rompere nulla
const LOGO_SRC = '/logo.png';

function sanitizeFiscalCode(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '').toUpperCase();
}

export default function AccountWaiverPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [logoOk, setLogoOk] = useState(true);

  const prevTitleRef = useRef<string | null>(null);

  useEffect(() => {
    // Evita che in stampa compaia il titolo nel header/filename
    prevTitleRef.current = document.title;
    document.title = '';

    const handleBeforePrint = () => {
      document.title = '';
    };

    const handleAfterPrint = () => {
      document.title = prevTitleRef.current ?? '';
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.title = prevTitleRef.current ?? '';
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: e } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, fiscal_code')
          .eq('user_id', user.id)
          .maybeSingle();

        if (e) {
          setError(e.message);
          setProfile(null);
          return;
        }

        setProfile((data as Profile | null) ?? null);
      } catch (err) {
        console.error(err);
        setError('Errore nel caricamento della liberatoria.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [authLoading, user]);

  const missing = useMemo(() => {
    const m: string[] = [];
    const first = (profile?.first_name ?? '').trim();
    const last = (profile?.last_name ?? '').trim();
    const cf = sanitizeFiscalCode(profile?.fiscal_code);

    if (!first) m.push('Nome');
    if (!last) m.push('Cognome');
    if (!cf) m.push('Codice fiscale');

    return m;
  }, [profile?.first_name, profile?.last_name, profile?.fiscal_code]);

  const canRender = missing.length === 0;

  const fullName = useMemo(() => {
    const first = (profile?.first_name ?? '').trim();
    const last = (profile?.last_name ?? '').trim();
    return [first, last].filter(Boolean).join(' ').trim();
  }, [profile?.first_name, profile?.last_name]);

  const fiscalCode = useMemo(() => sanitizeFiscalCode(profile?.fiscal_code), [profile?.fiscal_code]);

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-700">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-100 text-[var(--text)]">
      <style>{`
        /* Stampa A4, una pagina */
        @page { size: A4; margin: 12mm; }

        @media print {
          .no-print { display: none !important; }

          html, body {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }

          main {
            padding: 0 !important;
            background: white !important;
            min-height: auto !important;
          }

          /* Evita overflow dovuto a space-y-* in stampa */
          .waiver-wrap > * { margin-top: 0 !important; }

          .waiver-paper {
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          /* Layout in colonna per tenere la firma in fondo */
          .waiver-page {
            display: flex !important;
            flex-direction: column !important;
            /* Altezza utile: A4 (297mm) - margini pagina (24mm) */
            min-height: 273mm !important;
          }

          /* Micro-compressione verticale per rientrare sempre in una pagina */
          .waiver-title { margin-top: 8mm !important; }
          .waiver-body { margin-top: 3mm !important; }
          .waiver-footer { margin-top: auto !important; }
          .waiver-signline { margin-top: 14mm !important; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-4 space-y-4 waiver-wrap">
        {/* Top bar */}
        <Card className="no-print">
          <CardContent className="space-y-3">
            <SectionHeader
              title="Liberatoria"
              subtitle="Stampa e firma la liberatoria precompilata"
              action={
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => router.push('/account')}>
                    Indietro
                  </Button>
                  <Button variant="primary" onClick={() => window.print()} disabled={!canRender}>
                    Stampa
                  </Button>
                </div>
              }
            />
            {error ? (
              <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {!canRender ? (
          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900">Dati mancanti</h2>
              <p className="text-sm text-gray-700">Per generare la liberatoria mancano:</p>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="text-[11px] text-gray-500">
                Torna su “Dati proprietario” e inserisci/salva i dati richiesti.
              </p>
              <div className="pt-2 no-print">
                <Button variant="secondary" onClick={() => router.push('/account')}>
                  Vai ai dati proprietario
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="waiver-paper bg-white">
            <CardContent className="p-6 print:p-0">
              <article className="waiver-page">
                {/* Header */}
                <header className="flex items-start justify-between gap-6">
                  <div className="text-sm text-gray-900">
                    <p className="font-semibold">{COMPANY.name}</p>
                    <p>{COMPANY.addressLine}</p>
                    <p>{COMPANY.city}</p>
                    <p className="mt-1">{COMPANY.vatLabel}</p>
                  </div>

                  <div className="flex items-start justify-end">
                    {logoOk ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={LOGO_SRC}
                        alt="Logo"
                        className="h-12 w-auto object-contain"
                        onError={() => setLogoOk(false)}
                      />
                    ) : null}
                  </div>
                </header>

                <h1 className="waiver-title text-xl font-bold text-center mt-6">Liberatoria</h1>

                {/* Body */}
                <section className="waiver-body mt-4 text-sm leading-relaxed text-gray-900 space-y-3">
                  <p>
                    Per l’eventualità che durante il periodo di permanenza dell’animale custodito all’interno della
                    struttura, lo stesso dovesse essere colpito da malattie e/o infortuni, il cliente autorizza
                    espressamente la pensione a chiamare, senza indugio, il Direttore Sanitario della struttura,
                    medico veterinario di fiducia di quest’ultima, affinchè predisponga a sua discrezione e
                    compatibilmente con l’urgenza richiesta dalla singola situazione, tutte le cure e gli interventi
                    veterinari ritenuti necessari allo scopo, fermo restando che la pensione provvederà ad avvisare
                    il proprietario nel più breve tempo possibile.
                  </p>

                  <p>
                    Resta inteso che, tutte le spese sostenute dalla pensione per le prestazioni che siano state
                    effettuate nell’interesse dell’animale, dovranno essere rimborsate dal cliente e che la struttura
                    non assume alcuna responsabilità in ordine agli esiti delle stesse sulla sua salute.
                  </p>

                  <h2 className="font-semibold mt-4">Nota Bene</h2>
                  <p>
                    La tariffa relativa al soggiorno dell’animale scatta dal giorno di ingresso, indipendentemente
                    dall’orario di entrata. Il giorno di uscita non viene calcolato se il box viene liberato entro le
                    ore 13,00, in caso di uscita dell’animale dalla struttura nel pomeriggio, la giornata verrà
                    calcolata per intero.
                  </p>

                  <p>
                    Una volta sottoscritto il contratto di fornitura del servizio, ogni eventuale modifica o
                    ripensamento dello stesso, comporterà comunque l’addebito dell’intero soggiorno prenotato.
                  </p>
                </section>

                {/* Footer firma */}
                <footer className="waiver-footer mt-10">
                  <div className="flex items-end justify-between gap-6">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Per presa visione e accettazione</p>
                      <div className="waiver-signline mt-8 border-b border-gray-400 w-full" />
                      <p className="text-[11px] text-gray-500 mt-2">Firma</p>
                    </div>

                    <div className="text-sm text-gray-900 text-right">
                      <p className="font-semibold">{fullName}</p>
                      <p className="mt-1">
                        <span className="font-medium">C.F.:</span> {fiscalCode}
                      </p>
                    </div>
                  </div>
                </footer>
              </article>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}