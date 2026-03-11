// FILE: pawny-webapp/app/settings/page.tsx
'use client';

import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Impostazioni</h1>
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
          >
            Torna al profilo
          </button>
        </header>

        <section className="bg-white rounded-lg shadow p-4 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Account</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push('/account')}
              className="text-left rounded border border-gray-200 p-3 hover:bg-gray-50"
            >
              <div className="text-sm font-medium">Dati e documenti</div>
              <div className="text-xs text-gray-600 mt-1">
                Documento identità, liberatoria, dati personali.
              </div>
            </button>

            <button
              type="button"
              onClick={() => router.push('/account/password')}
              className="text-left rounded border border-gray-200 p-3 hover:bg-gray-50"
            >
              <div className="text-sm font-medium">Cambia password</div>
              <div className="text-xs text-gray-600 mt-1">
                Aggiorna la password del tuo account.
              </div>
            </button>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-4 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Scheda cane (QR)</h2>
          <p className="text-sm text-gray-700">
            Le preferenze di visibilità della scheda cane si gestiscono dalla pagina del cane.
          </p>

          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="px-4 py-2 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50"
          >
            Vai ai tuoi cani
          </button>

          <p className="text-xs text-gray-500">
            Apri un cane → “Personalizza scheda cane”.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow p-4 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Legale</h2>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push('/privacy')}
              className="px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
            >
              Privacy
            </button>

            <button
              type="button"
              onClick={() => router.push('/terms')}
              className="px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
            >
              Termini
            </button>

            <button
              type="button"
              onClick={() => router.push('/cookies')}
              className="px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
            >
              Cookie
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Tenuta del Barone Srls – Via Davide Passigli 60, Fiumicino – P.IVA 16378301002
          </p>
        </section>
      </div>
    </main>
  );
}
