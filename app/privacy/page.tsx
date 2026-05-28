// FILE: pawny-webapp/app/privacy/page.tsx
import { BackButton } from '@/components/common/BackButton';

export const metadata = {
  title: 'Privacy Policy | Tenuta del Barone',
};

const LAST_UPDATED = '5 maggio 2026';

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
            <strong>Tenuta del Barone srls</strong> – P.IVA <strong>16378301002</strong>
            <br />
            Sede: <strong>Via Davide Passigli 60, 00054 Fiumicino RM</strong>
            <br />
            PEC: <strong>tenutadelbarone-srls@legalmail.it</strong>
            <br />
            Codice SDI: <strong>N92GLON</strong>
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
            <li>Dati relativi a prenotazioni, pacchetti servizi, notifiche e conversazioni con assistenza o chatbot.</li>
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
            <li>
              Invio di comunicazioni di servizio e notifiche operative:
              <strong> esecuzione del servizio</strong> e/o <strong>legittimo interesse</strong>.
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
            o autonomi titolari, secondo il ruolo ricoperto. L’app utilizza <strong>Supabase</strong> per
            database, autenticazione e storage; <strong>OpenAI</strong> per le funzioni di chatbot;
            <strong> Resend</strong> per l’invio di email di servizio; servizi basati su
            <strong> OpenStreetMap/Nominatim</strong> e <strong>OSRM</strong> per ricerca indirizzi e
            calcolo indicativo delle distanze taxi dog.
          </p>
          <p className="ui-legalText">
            Il pagamento online non è attivo nell’app. Eventuali pagamenti vengono gestiti fuori dall’app
            o tramite conferma manuale del gestionale.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Trasferimenti extra UE</h2>
          <p className="ui-legalText">
            Alcuni fornitori tecnologici possono trattare dati anche fuori dallo Spazio Economico Europeo.
            In tali casi il Titolare verifica la presenza di adeguate garanzie contrattuali, come DPA,
            clausole contrattuali standard o altri strumenti previsti dalla normativa applicabile.
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
          <p className="ui-legalText">
            Le conversazioni e le notifiche sono conservate per il tempo utile alla gestione
            dell’assistenza e alla ricostruzione delle richieste operative.
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
          <h2 className="ui-legalH2">Decisioni automatizzate</h2>
          <p className="ui-legalText">
            Il chatbot può fornire risposte automatiche basate sulla knowledge base e sui dati operativi
            disponibili, ma non prende decisioni con effetti giuridici o analogamente significativi sul
            cliente. Nei casi delicati la conversazione può essere inoltrata a un operatore.
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
            Ultimo aggiornamento: {LAST_UPDATED}
          </p>
        </div>
      </div>
    </main>
  );
}
