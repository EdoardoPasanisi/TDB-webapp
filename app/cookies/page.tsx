// FILE: pawny-webapp/app/cookies/page.tsx
import { BackButton } from '@/components/common/BackButton';

export const metadata = {
  title: 'Cookie e strumenti tecnici | Tenuta del Barone',
};

const LAST_UPDATED = '5 maggio 2026';

export default function CookiesPage() {
  return (
    <main className="ui-legalMain">
      <div className="ui-legalContainer">
        <BackButton hrefFallback="/signup" showOnMobile />
        <div className="ui-legalCard">
          <h1 className="ui-legalTitle">Cookie e strumenti tecnici</h1>

        <p className="ui-legalText">
          Questo sito/app utilizza <strong>strumenti tecnici</strong> necessari al funzionamento
          del servizio (es. mantenimento sessione, sicurezza, funzionalità di base).
          Non utilizziamo cookie di profilazione o tracciamento pubblicitario.
        </p>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Cosa usiamo</h2>
          <ul className="ui-legalList">
            <li>Cookie e storage tecnico di Supabase per login, mantenimento sessione e sicurezza.</li>
            <li>Archiviazioni locali tecniche per bozze di prenotazione e preferenze operative dell’interfaccia.</li>
            <li>Log tecnici per diagnosi e prevenzione abusi.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Consenso</h2>
          <p className="ui-legalText">
            Per strumenti <strong>strettamente necessari</strong> non è richiesto un consenso tramite banner.
            Se in futuro verranno introdotti strumenti di tracciamento (es. analytics non tecnici),
            verrà mostrato un banner e richiesto il consenso ove necessario.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="ui-legalH2">Titolare del trattamento</h2>
          <p className="ui-legalText">
            <strong>Tenuta del Barone srls</strong> – P.IVA <strong>16378301002</strong>
            <br />
            Via Davide Passigli 60, 00054 Fiumicino RM
            <br />
            PEC: <strong>tenutadelbarone-srls@legalmail.it</strong>
            <br />
            Codice SDI: <strong>N92GLON</strong>
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
