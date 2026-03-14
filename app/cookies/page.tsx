// FILE: pawny-webapp/app/cookies/page.tsx
import { BackButton } from '@/components/common/BackButton';

export const metadata = {
  title: 'Cookie e strumenti tecnici | Tenuta del Barone',
};

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
            <li>Archiviazioni tecniche (es. localStorage/sessione) per login e sicurezza.</li>
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

          <p className="ui-legalUpdated">
            Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
          </p>
        </div>
      </div>
    </main>
  );
}
