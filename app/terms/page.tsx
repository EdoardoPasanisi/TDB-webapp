// FILE: pawny-webapp/app/terms/page.tsx
import { BackButton } from '@/components/common/BackButton';

export const metadata = {
  title: 'Termini di Servizio | Tenuta del Barone',
};

const LAST_UPDATED = '5 maggio 2026';

export default function TermsPage() {
  return (
    <main className="ui-legalMain">
      <div className="ui-legalContainer">
        <BackButton hrefFallback="/signup" showOnMobile />
        <div className="ui-legalCard">
          <h1 className="ui-legalTitle">Termini di Servizio</h1>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Titolare</h2>
          <p className="ui-legalText">
            <strong>Tenuta del Barone srls</strong> – P.IVA <strong>16378301002</strong>
            <br />
            Via Davide Passigli 60, 00054 Fiumicino RM
            <br />
            PEC: <strong>tenutadelbarone-srls@legalmail.it</strong>
            <br />
            Codice SDI: <strong>N92GLON</strong>
            <br />
            Email: <strong>info@latenutadelbaroneroma.it</strong>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Oggetto del servizio</h2>
          <p className="ui-legalText">
            L’app consente di gestire il profilo cliente, i dati del cane, le richieste/prenotazioni
            e il caricamento di documenti (es. documento d’identità, liberatoria).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Account e responsabilità</h2>
          <ul className="ui-legalList">
            <li>Sei responsabile della riservatezza delle credenziali e delle attività svolte con il tuo account.</li>
            <li>Devi inserire informazioni veritiere e aggiornate.</li>
            <li>Il Titolare può sospendere l’accesso in caso di uso improprio o violazioni.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Documenti e verifiche</h2>
          <p className="ui-legalText">
            I documenti caricati possono essere soggetti a verifica interna. In caso di documento illeggibile
            o non idoneo, potrà essere richiesto di caricare una nuova versione.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Prenotazioni e pagamenti</h2>
          <p className="ui-legalText">
            L’app consente di inviare richieste e prenotazioni e di acquistare o utilizzare pacchetti
            servizi secondo le disponibilità configurate. Il pagamento online in app non è attivo:
            eventuali incassi, conferme o sblocchi dei pacchetti vengono gestiti fuori dall’app o dal
            gestionale interno.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Limitazioni di responsabilità</h2>
          <p className="ui-legalText">
            Il servizio è fornito “così com’è”. Pur adottando misure ragionevoli per garantire continuità
            e corretto funzionamento, non possiamo garantire assenza totale di interruzioni o errori.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Modifiche</h2>
          <p className="ui-legalText">
            I Termini possono essere aggiornati. La versione più recente sarà disponibile in questa pagina.
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
