// FILE: pawny-webapp/app/terms/page.tsx
export const metadata = {
  title: 'Termini di Servizio | Tenuta del Barone',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">Termini di Servizio</h1>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Titolare</h2>
          <p className="text-sm text-gray-800">
            <strong>Tenuta del Barone Srls</strong> – P.IVA <strong>16378301002</strong>
            <br />
            Via Davide Passigli 60, Fiumicino
            <br />
            Email: <strong>info@latenutadelbaroneroma.it</strong>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Oggetto del servizio</h2>
          <p className="text-sm text-gray-800">
            L’app consente di gestire il profilo cliente, i dati del cane, le richieste/prenotazioni
            e il caricamento di documenti (es. documento d’identità, liberatoria).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Account e responsabilità</h2>
          <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
            <li>Sei responsabile della riservatezza delle credenziali e delle attività svolte con il tuo account.</li>
            <li>Devi inserire informazioni veritiere e aggiornate.</li>
            <li>Il Titolare può sospendere l’accesso in caso di uso improprio o violazioni.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Documenti e verifiche</h2>
          <p className="text-sm text-gray-800">
            I documenti caricati possono essere soggetti a verifica interna. In caso di documento illeggibile
            o non idoneo, potrà essere richiesto di caricare una nuova versione.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Limitazioni di responsabilità</h2>
          <p className="text-sm text-gray-800">
            Il servizio è fornito “così com’è”. Pur adottando misure ragionevoli per garantire continuità
            e corretto funzionamento, non possiamo garantire assenza totale di interruzioni o errori.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Modifiche</h2>
          <p className="text-sm text-gray-800">
            I Termini possono essere aggiornati. La versione più recente sarà disponibile in questa pagina.
          </p>
        </section>

        <p className="text-xs text-gray-500 pt-2">
          Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
        </p>
      </div>
    </main>
  );
}
