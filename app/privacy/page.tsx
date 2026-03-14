// FILE: pawny-webapp/app/privacy/page.tsx
import { BackButton } from '@/components/common/BackButton';

export const metadata = {
  title: 'Privacy Policy | Tenuta del Barone',
};

export default function PrivacyPage() {
  return (
    <main className="ui-legalMain">
      <div className="ui-legalContainer">
        <BackButton hrefFallback="/signup" showOnMobile />
        <div className="ui-legalCard">
          <h1 className="ui-legalTitle">Informativa Privacy (art. 13 GDPR)</h1>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Titolare del trattamento</h2>
          <p className="ui-legalText">
            <strong>Tenuta del Barone Srls</strong> – P.IVA <strong>16378301002</strong>
            <br />
            Sede: <strong>Via Davide Passigli 60, Fiumicino</strong>
            <br />
            Contatto: <strong>info@latenutadelbaroneroma.it</strong>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Dati trattati</h2>
          <ul className="ui-legalList">
            <li>Dati account: email e credenziali (gestite dal provider di autenticazione).</li>
            <li>Dati anagrafici e di contatto: nome, cognome, telefono, indirizzo (se forniti).</li>
            <li>Dati relativi al cane: nome, razza, sesso, taglia, microchip (se fornito), note, foto.</li>
            <li>Documenti caricati: documento d’identità e liberatoria firmata (se caricati).</li>
            <li>Dati tecnici: log e informazioni tecniche necessarie al funzionamento del servizio.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Finalità e base giuridica</h2>
          <ul className="ui-legalList">
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
          <p className="ui-legalText">
            Il conferimento di alcuni dati può essere necessario per utilizzare determinate funzioni
            (es. documenti). Se non forniti, alcune funzionalità potrebbero non essere disponibili.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Destinatari e fornitori</h2>
          <p className="ui-legalText">
            I dati possono essere trattati da fornitori che operano come responsabili del trattamento
            (es. infrastruttura cloud e database). L’app utilizza <strong>Supabase</strong> per database,
            autenticazione e storage; è disponibile un Data Processing Addendum (DPA) del fornitore.
          </p>
          <p className="ui-legalText">
            Per la conformità contrattuale con i fornitori, il Titolare sottoscrive o rende disponibili
            gli accordi necessari (DPA).{' '}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Conservazione</h2>
          <p className="ui-legalText">
            Conserviamo i dati per il tempo necessario alle finalità per cui sono raccolti e/o per gli
            obblighi di legge. In particolare, i documenti caricati (documento d’identità e liberatoria)
            vengono conservati finché necessari alla gestione del servizio e alle verifiche interne,
            o per periodi ulteriori se richiesti da obblighi di legge.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Diritti dell’interessato</h2>
          <p className="ui-legalText">
            Puoi esercitare i diritti previsti dal GDPR (accesso, rettifica, cancellazione, limitazione,
            opposizione, portabilità, ove applicabile) contattando{' '}
            <strong>info@latenutadelbaroneroma.it</strong>. Hai inoltre diritto di proporre reclamo
            all’Autorità Garante per la protezione dei dati personali.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Sicurezza</h2>
          <p className="ui-legalText">
            Adottiamo misure tecniche e organizzative ragionevoli per proteggere i dati (controllo accessi,
            separazione ruoli, protezione dell’infrastruttura e gestione credenziali).
          </p>
        </section>

          <p className="ui-legalUpdated">
            Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
          </p>
        </div>
      </div>
    </main>
  );
}
