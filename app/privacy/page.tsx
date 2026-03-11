// FILE: pawny-webapp/app/privacy/page.tsx
export const metadata = {
  title: 'Privacy Policy | Tenuta del Barone',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">Informativa Privacy (art. 13 GDPR)</h1>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Titolare del trattamento</h2>
          <p className="text-sm text-gray-800">
            <strong>Tenuta del Barone Srls</strong> – P.IVA <strong>16378301002</strong>
            <br />
            Sede: <strong>Via Davide Passigli 60, Fiumicino</strong>
            <br />
            Contatto: <strong>info@latenutadelbaroneroma.it</strong>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Dati trattati</h2>
          <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
            <li>Dati account: email e credenziali (gestite dal provider di autenticazione).</li>
            <li>Dati anagrafici e di contatto: nome, cognome, telefono, indirizzo (se forniti).</li>
            <li>Dati relativi al cane: nome, razza, sesso, taglia, microchip (se fornito), note, foto.</li>
            <li>Documenti caricati: documento d’identità e liberatoria firmata (se caricati).</li>
            <li>Dati tecnici: log e informazioni tecniche necessarie al funzionamento del servizio.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Finalità e base giuridica</h2>
          <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
            <li>
              Erogazione del servizio (gestione profilo, cani, prenotazioni, documenti):
              <strong> esecuzione di un contratto</strong> o misure precontrattuali.
            </li>
            <li>
              Adempimenti amministrativi/legali connessi al servizio:
              <strong> obbligo di legge</strong> (quando applicabile).
            </li>
            <li>
              Sicurezza e prevenzione abusi:
              <strong> legittimo interesse</strong> del Titolare.
            </li>
          </ul>
          <p className="text-sm text-gray-800">
            Il conferimento di alcuni dati può essere necessario per utilizzare determinate funzioni
            (es. documenti). Se non forniti, alcune funzionalità potrebbero non essere disponibili.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Destinatari e fornitori</h2>
          <p className="text-sm text-gray-800">
            I dati possono essere trattati da fornitori che operano come responsabili del trattamento
            (es. infrastruttura cloud e database). L’app utilizza <strong>Supabase</strong> per database,
            autenticazione e storage; è disponibile un Data Processing Addendum (DPA) del fornitore.
          </p>
          <p className="text-sm text-gray-800">
            Per la conformità contrattuale con i fornitori, il Titolare sottoscrive o rende disponibili
            gli accordi necessari (DPA).{' '}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Conservazione</h2>
          <p className="text-sm text-gray-800">
            Conserviamo i dati per il tempo necessario alle finalità per cui sono raccolti e/o per gli
            obblighi di legge. In particolare, i documenti caricati (documento d’identità e liberatoria)
            vengono conservati finché necessari alla gestione del servizio e alle verifiche interne,
            o per periodi ulteriori se richiesti da obblighi di legge.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Diritti dell’interessato</h2>
          <p className="text-sm text-gray-800">
            Puoi esercitare i diritti previsti dal GDPR (accesso, rettifica, cancellazione, limitazione,
            opposizione, portabilità, ove applicabile) contattando{' '}
            <strong>info@latenutadelbaroneroma.it</strong>. Hai inoltre diritto di proporre reclamo
            all’Autorità Garante per la protezione dei dati personali.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Sicurezza</h2>
          <p className="text-sm text-gray-800">
            Adottiamo misure tecniche e organizzative ragionevoli per proteggere i dati (controllo accessi,
            separazione ruoli, protezione dell’infrastruttura e gestione credenziali).
          </p>
        </section>

        <p className="text-xs text-gray-500 pt-2">
          Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
        </p>
      </div>
    </main>
  );
}
