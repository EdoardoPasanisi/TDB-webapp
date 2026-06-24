'use client';

// app/account/waiver/page.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
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
          setError(humanizeErrorMessage(e, 'Non siamo riusciti a caricare la liberatoria.'));
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
      <main className="ui-page min-h-screen flex items-center justify-center">
        <p className="ui-muted">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="ui-page min-h-screen">
      <style>{`
        @page { size: A4 portrait; margin: 0; }

        .print-only { display: none; }
        .waiver-page {
          color: var(--text);
        }
        .waiver-page * {
          color: inherit;
        }

        @media print {
          [data-app-chrome] { display: none !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }

          /* iOS Safari stampa "WYSIWYG" e scala il layout alla larghezza del
             viewport del telefono: usare percentuali produce una colonna
             stretta. Diamo quindi al foglio una larghezza FISICA (mm) così
             la resa è un A4 corretto su qualsiasi dispositivo. Il margine di
             stampa è gestito dal padding interno del foglio (non da @page),
             così è uguale su mobile e desktop. */
          html {
            -webkit-text-size-adjust: 100% !important;
            text-size-adjust: 100% !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #000 !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          main {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            min-height: 0 !important;
          }

          .waiver-wrap {
            max-width: none !important;
            width: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .waiver-wrap > * {
            margin-top: 0 !important;
          }

          .waiver-paper {
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
            background: white !important;
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 auto !important;
          }

          .waiver-paper > * {
            padding: 0 !important;
          }

          /* Foglio A4 deterministico con margine interno. */
          .waiver-page {
            box-sizing: border-box !important;
            width: 210mm !important;
            padding: 15mm 16mm !important;
            margin: 0 auto !important;
            display: block !important;
            color: #000 !important;
          }

          .waiver-page * {
            color: #000 !important;
            text-shadow: none !important;
          }

          .waiver-print-head {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            gap: 8mm !important;
            font-size: 10px !important;
            line-height: 1.3 !important;
            margin-bottom: 2mm !important;
          }

          .waiver-print-company {
            flex: 1 1 auto;
          }

          .waiver-print-logo {
            display: block !important;
            width: 38mm !important;
            max-height: 20mm !important;
            object-fit: contain !important;
            background: transparent !important;
            padding: 0 !important;
            border-radius: 0 !important;
            filter: none !important;
          }

          .waiver-title {
            width: 100% !important;
            margin: 0 0 5mm !important;
            font-size: 30px !important;
            line-height: 1.2 !important;
            text-align: center !important;
          }

          .waiver-body {
            width: 100% !important;
            font-size: 14px !important;
            line-height: 1.5 !important;
            margin: 0 !important;
            text-align: justify !important;
            text-justify: inter-word !important;
          }

          .waiver-body p {
            margin: 0 !important;
          }

          .waiver-body p + p {
            margin-top: 1.2mm !important;
          }

          .waiver-nota {
            margin-top: 5mm !important;
            margin-bottom: 2.2mm !important;
            font-size: 14px !important;
          }

          .waiver-signature {
            width: 100% !important;
            margin: 28mm 0 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .waiver-client-data {
            font-size: 12px !important;
            line-height: 1.3 !important;
            margin-bottom: 6mm !important;
          }

          .waiver-signblock {
            max-width: 96mm !important;
          }

          .waiver-signline {
            width: 100% !important;
            margin-top: 3.2mm !important;
          }
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
              <div className="ui-error">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {!canRender ? (
          <Card>
            <CardContent className="space-y-2">
              <h2 className="ui-h2">Dati mancanti</h2>
              <p className="ui-body">Per generare la liberatoria mancano:</p>
              <ul className="list-disc pl-5 ui-body">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="ui-muted">
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
          <Card className="waiver-paper">
            <CardContent className="p-6 print:p-0">
              <article className="waiver-page">
                <header className="waiver-print-head print-only">
                  <div className="waiver-print-company">
                    <p className="font-semibold">{COMPANY.name}</p>
                    <p>{COMPANY.addressLine}</p>
                    <p>{COMPANY.city}</p>
                    <p>{COMPANY.vatLabel}</p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/tenuta-logo-print.png" alt="Tenuta del Barone" className="waiver-print-logo" />
                </header>

                <h1 className="waiver-title ui-title">Liberatoria</h1>

                {/* Body */}
                <section className="waiver-body text-[17px] leading-7 space-y-3">
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

                  <h2 className="waiver-nota text-[17px] font-[var(--font-weight-semibold)]">Nota Bene</h2>
                  <p>
                    La tariffa relativa al soggiorno dell’animale scatta dal giorno di ingresso, indipendentemente
                    dall’orario di entrata. Il giorno di uscita non viene calcolato se il box viene liberato entro le
                    ore 13:00, in caso di uscita dell’animale dalla struttura nel pomeriggio, la giornata verrà
                    calcolata per intero.
                  </p>

                  <p>
                    Una volta sottoscritto il contratto di fornitura del servizio, ogni eventuale modifica o
                    ripensamento dello stesso, comporterà comunque l’addebito dell’intero soggiorno prenotato.
                  </p>
                </section>

                <footer className="waiver-signature print-only">
                  <div className="waiver-client-data ui-body">
                    <p className="font-[var(--font-weight-semibold)]">{fullName}</p>
                    <p className="mt-1">
                      <span className="font-[var(--font-weight-semibold)]">C.F.:</span> {fiscalCode}
                    </p>
                  </div>

                  <div className="waiver-signblock">
                    <p className="ui-body font-[var(--font-weight-semibold)]">Firma cliente</p>
                    <div className="waiver-signline border-b border-gray-400" />
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
