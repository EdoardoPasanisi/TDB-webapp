// FILE: pawny-webapp/app/cookies/page.tsx
export const metadata = {
  title: 'Cookie e strumenti tecnici | Tenuta del Barone',
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">Cookie e strumenti tecnici</h1>

        <p className="text-sm text-gray-800">
          Questo sito/app utilizza <strong>strumenti tecnici</strong> necessari al funzionamento
          del servizio (es. mantenimento sessione, sicurezza, funzionalità di base).
          Non utilizziamo cookie di profilazione o tracciamento pubblicitario.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Cosa usiamo</h2>
          <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
            <li>Archiviazioni tecniche (es. localStorage/sessione) per login e sicurezza.</li>
            <li>Log tecnici per diagnosi e prevenzione abusi.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Consenso</h2>
          <p className="text-sm text-gray-800">
            Per strumenti <strong>strettamente necessari</strong> non è richiesto un consenso tramite banner.
            Se in futuro verranno introdotti strumenti di tracciamento (es. analytics non tecnici),
            verrà mostrato un banner e richiesto il consenso ove necessario.
          </p>
        </section>

        <p className="text-xs text-gray-500 pt-2">
          Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
        </p>
      </div>
    </main>
  );
}
