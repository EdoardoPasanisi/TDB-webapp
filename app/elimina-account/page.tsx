// Pagina pubblica sull'eliminazione dell'account. Google Play la richiede (sezione
// "Sicurezza dei dati" → URL per l'eliminazione dell'account) per le app in cui ci si
// registra: deve essere raggiungibile senza app e senza login. Deve restare coerente con
// lib/account/deleteAccount.ts (cosa viene cancellato davvero).
import { BackButton } from '@/components/common/BackButton';

export const metadata = {
  title: 'Eliminare il tuo account | Tenuta del Barone',
  description: 'Come eliminare il tuo account Tenuta del Barone e quali dati vengono cancellati.',
};

const CONTACT_EMAIL = 'info@latenutadelbaroneroma.it';

export default function DeleteAccountPage() {
  return (
    <main className="ui-legalMain">
      <div className="ui-legalContainer">
        <BackButton hrefFallback="/" showOnMobile />
        <div className="ui-legalCard">
          <h1 className="ui-legalTitle">Eliminare il tuo account Tenuta del Barone</h1>

          <section className="space-y-2">
            <h2 className="ui-legalH2">Dall’app (consigliato)</h2>
            <ol className="ui-legalList">
              <li>Apri l’app Tenuta del Barone (o il sito app.tenutadelbarone.com) e accedi.</li>
              <li>
                Vai in <strong>Impostazioni</strong> → <strong>Elimina account</strong>.
              </li>
              <li>Conferma l’eliminazione. L’account viene cancellato subito.</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="ui-legalH2">Senza app</h2>
            <p className="ui-legalText">
              Se non riesci ad accedere, scrivi a <strong>{CONTACT_EMAIL}</strong> dall’indirizzo email con cui ti sei
              registrato, con oggetto “Eliminazione account”. Elaboriamo la richiesta entro 30 giorni e ti confermiamo
              l’avvenuta cancellazione.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="ui-legalH2">Quali dati vengono eliminati</h2>
            <ul className="ui-legalList">
              <li>Account e credenziali di accesso, dati anagrafici e di contatto.</li>
              <li>Profili dei tuoi animali, con foto e documenti caricati (compreso il documento d’identità).</li>
              <li>Prenotazioni, pacchetti servizi, saldo e storico pagamenti.</li>
              <li>Foto e video ricevuti, notifiche, preferenze e conversazioni con l’assistenza.</li>
            </ul>
            <p className="ui-legalText">
              L’eliminazione è definitiva e non può essere annullata. Per maggiori dettagli consulta
              l’<a href="/privacy">informativa privacy</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
