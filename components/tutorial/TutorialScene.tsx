'use client';

/* eslint-disable @next/next/no-img-element */

import QRCode from 'react-qr-code';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { DogPublicCard, type PublicDogCardDog, type PublicDogCardOwner } from '@/components/dogs/DogPublicCard';
import type { TutorialScene as SceneKey } from './tutorialSteps';

/* ---------- Dati di esempio (cane "tipo") ---------- */

const SAMPLE_DOG: PublicDogCardDog = {
  id: 'demo',
  name: 'Rocky',
  updated_at: null,
  breed: 'Labrador Retriever',
  sex: 'male',
  size_category: 'grande',
  microchip: '380260000000000',
  birth_date: '2021-05-14',
  notes: 'Socievole con altri cani. Allergia ai cereali.',
  coat_color: 'Nero',
  temperament: ['giocherellone', 'affettuoso'],
  photo_path: null,
  show_breed: true,
  show_sex: true,
  show_size: true,
  show_microchip: true,
  show_birth_date: true,
  show_notes: true,
  show_coat_color: true,
  show_temperament: true,
};

const SAMPLE_OWNER: PublicDogCardOwner = {
  id: 'demo-owner',
  first_name: 'Marco',
  last_name: 'Rossi',
  phone: '+39 333 1234567',
  email: null,
  address_line: null,
  city: null,
  zip_code: null,
  province: null,
  dog_address_line: null,
  dog_city: null,
  dog_zip_code: null,
  dog_province: null,
  show_first_name_on_dog_card: true,
  show_last_name_on_dog_card: true,
  show_phone_on_dog_card: true,
  show_email_on_dog_card: false,
  show_address_on_dog_card: false,
  show_dog_address_on_dog_card: false,
};

/* ---------- Helpers UI ---------- */

function Spot({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <div data-spot={id} className={className}>
      {children}
    </div>
  );
}

function DemoAvatar({ initials }: { initials: string }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text)] font-[var(--font-weight-bold)]">
      {initials}
    </div>
  );
}

function Chevron() {
  return <span className="ui-muted">›</span>;
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 2v4M16 2v4" />
      <path d="M3 10h18" />
      <path d="M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M12 4.75a4 4 0 0 0-4 4v1.19c0 .88-.29 1.74-.84 2.43l-1.1 1.4a1.75 1.75 0 0 0 1.37 2.83h9.14a1.75 1.75 0 0 0 1.37-2.83l-1.1-1.4A3.9 3.9 0 0 1 16 9.94V8.75a4 4 0 0 0-4-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.75 18.25a2.25 2.25 0 0 0 4.5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Chrome di navigazione mock, responsive (come l'app reale):
 * - mobile: top bar (impostazioni/profilo) + bottom nav (chat / home / calendario)
 * - desktop: header con logo, link e icone.
 * Ogni voce ha un data-spot per poter essere illuminata. Le voci esistono sia in
 * versione mobile che desktop: l'overlay illumina quella effettivamente visibile.
 */
function MockChrome({ children, title = 'Tenuta del Barone' }: { children: ReactNode; title?: string }) {
  return (
    <div className="tut-app">
      {/* MOBILE top bar */}
      <div className="tut-topbar md:hidden">
        <div className="ui-topbarShell">
          <div className="ui-topbarSide ui-topbarSide--left">
            <span data-spot="nav-settings" className="ui-topbarIconBtn">
              <img src="/icon-settings.png" alt="" width={24} height={24} className="h-6 w-6" />
            </span>
            <span className="ui-topbarIconBtn" aria-hidden><BellIcon /></span>
          </div>
          <div className="ui-topbarTitle">{title}</div>
          <div className="ui-topbarSide ui-topbarSide--right">
            <span data-spot="nav-profile" className="ui-topbarIconBtn">
              <img src="/icon-user.png" alt="" width={24} height={24} className="h-6 w-6" />
            </span>
          </div>
        </div>
      </div>

      {/* DESKTOP header */}
      <div className="tut-desktopTop hidden md:block">
        <div className="ui-desktopTopShell">
          <nav className="mx-auto grid max-w-[1100px] grid-cols-[auto_1fr_auto] items-center gap-8 px-6 py-3">
            <img src="/tenuta-logo.png" alt="" className="h-[48px] w-auto" />
            <div className="flex items-center justify-center gap-4 text-sm">
              <span data-spot="nav-home" className="ui-navLinkBtn ui-navLinkBtn--active">Servizi</span>
              <span data-spot="nav-calendar" className="ui-navLinkBtn">Calendario</span>
              <span data-spot="nav-chat" className="ui-navLinkBtn">Chat</span>
            </div>
            <div className="flex items-center justify-end gap-3">
              <span data-spot="nav-settings" className="ui-desktopTopIconBtn">
                <img src="/icon-settings.png" alt="" width={24} height={24} className="h-6 w-6" />
              </span>
              <span className="ui-desktopTopIconBtn" aria-hidden><BellIcon /></span>
              <span data-spot="nav-profile" className="ui-desktopTopIconBtn">
                <img src="/icon-user.png" alt="" width={24} height={24} className="h-6 w-6" />
              </span>
            </div>
          </nav>
        </div>
      </div>

      {/* BODY */}
      <div className="tut-body">
        <div className="mx-auto w-full max-w-md px-4 py-5 space-y-4">{children}</div>
      </div>

      {/* MOBILE bottom nav */}
      <div className="tut-bottomnav md:hidden">
        <div className="ui-bottomNavShell">
          <div className="relative mx-auto flex h-[74px] w-full max-w-xl items-center justify-between px-8">
            <span data-spot="nav-chat" className="ui-bottomNavActionBtn">
              <IconChat />
              <span className="ui-bottomNavActionBtn__label">Chat</span>
            </span>
            <div className="w-[86px]" aria-hidden="true" />
            <span data-spot="nav-calendar" className="ui-bottomNavActionBtn">
              <IconCalendar />
              <span className="ui-bottomNavActionBtn__label">Calendario</span>
            </span>
            <span
              data-spot="nav-home"
              className="ui-bottomNavCenterTap absolute left-1/2 -translate-x-1/2 -top-9"
            >
              <span className="ui-bottomNavCenterBtn ui-bottomNavCenterBtn--active">
                <img src="/tenuta-logo.png" alt="" className="h-[62px] w-[62px] rounded-full object-contain" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Scene ---------- */

function ProfileScene() {
  return (
    <MockChrome>
      {/* Banner dati personali */}
      <Spot id="account">
        <div className="ui-profileHero">
          <div className="px-4 pb-5 pt-4">
            <div className="flex items-center gap-3">
              <DemoAvatar initials="MR" />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-extrabold truncate">Marco Rossi</div>
                <div className="ui-note ui-profileHeroMuted truncate">marco.rossi@email.it</div>
                <div className="mt-1 ui-fine ui-profileHeroMuted">Dati, documenti e liberatoria</div>
              </div>
              <Chevron />
            </div>
          </div>
        </div>
      </Spot>

      {/* Indirizzo servizi */}
      <Spot id="service-address">
        <Card>
          <CardContent className="space-y-2">
            <div className="ui-panelInset p-3">
              <p className="ui-muted">Indirizzo servizi</p>
              <p className="ui-body mt-1">Via dei Pini 4, 73100 Lecce (LE)</p>
            </div>
          </CardContent>
        </Card>
      </Spot>

      {/* I miei cani */}
      <Spot id="dogs">
        <section className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="ui-title text-[26px] leading-[0.95]">I miei cani</h2>
              <p className="mt-1 ui-body text-[16px] text-[var(--muted)]">1 profilo</p>
            </div>
            <div className="ui-btn ui-btnTone-primary shrink-0">+ Aggiungi</div>
          </div>
          <Card className="ui-cardHover">
            <CardContent className="flex items-center gap-3">
              <DemoAvatar initials="🐶" />
              <div className="min-w-0 flex-1">
                <div className="ui-body font-[var(--font-weight-semibold)] truncate">Rocky</div>
                <div className="mt-0.5 ui-muted truncate">Labrador Retriever • 4 anni</div>
              </div>
              <Chevron />
            </CardContent>
          </Card>
        </section>
      </Spot>
    </MockChrome>
  );
}

function DogScene() {
  const sampleUrl = 'https://tenutadelbarone.app/dogs/card/rocky-demo';
  return (
    <MockChrome>
      {/* Info cane */}
      <Spot id="dog-info">
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <DemoAvatar initials="🐶" />
              <div className="min-w-0">
                <h1 className="ui-h2 truncate">Rocky</h1>
                <p className="mt-1 ui-muted">Labrador Retriever • Maschio • 4 anni</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="ui-panelInset p-3">
                <p className="ui-muted">Taglia</p>
                <p className="ui-body mt-1">Grande</p>
              </div>
              <div className="ui-panelInset p-3">
                <p className="ui-muted">Microchip</p>
                <p className="ui-body mt-1">380260…</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Spot>

      {/* Scheda pubblica */}
      <Spot id="dog-card">
        <DogPublicCard dog={SAMPLE_DOG} owner={SAMPLE_OWNER} showFooter={false} />
      </Spot>

      {/* QR */}
      <Spot id="dog-qr">
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="flex justify-center">
              <div className="ui-qrFrame">
                <QRCode value={sampleUrl} size={148} />
              </div>
            </div>
            <div className="grid gap-2">
              <div className="ui-btn ui-btnTone-primary">Scarica QR</div>
              <div className="ui-btn ui-btnTone-secondary">Condividi</div>
            </div>
          </CardContent>
        </Card>
      </Spot>
    </MockChrome>
  );
}

const SERVICE_TILES = [
  { title: 'Pensione', icon: '/icon-pensione.png', tone: 'ui-serviceTone-pensione' },
  { title: 'Asilo', icon: '/icon-asilo.png', tone: 'ui-serviceTone-asilo' },
  { title: 'Addestramento', icon: '/icon-addestramento.png', tone: 'ui-serviceTone-addestramento' },
  { title: 'Consulenza', icon: '/icon-consulenza.png', tone: 'ui-serviceTone-consulenza' },
];

function ServicesScene() {
  return (
    <MockChrome>
      {/* Griglia servizi (come ServiceCards) */}
      <Spot id="services-grid">
        <section className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="ui-body font-[var(--font-weight-semibold)]">Servizi</h2>
              <p className="mt-0.5 ui-muted">Scegli un servizio per prenotare</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SERVICE_TILES.map((s) => (
              <Card key={s.title}>
                <CardContent className="p-0">
                  <div className="aspect-square flex flex-col items-center justify-center gap-3 px-3">
                    <div className={`h-16 w-16 rounded-2xl flex items-center justify-center ${s.tone}`}>
                      <img src={s.icon} alt="" className="h-10 w-10" />
                    </div>
                    <div className="ui-body font-[var(--font-weight-semibold)] leading-tight">{s.title}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </Spot>

      {/* Crediti (come ServicePassCards) */}
      <Spot id="credits">
        <section className="space-y-3">
          <div className="min-w-0">
            <h2 className="ui-body font-[var(--font-weight-semibold)]">Crediti</h2>
            <p className="mt-0.5 ui-muted">Tocca una tessera per fissare una data</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Addestramento · Sessione 60 min', credits: 4 },
              { label: 'Consulenza cinofila', credits: 2 },
            ].map((g) => (
              <Card key={g.label}>
                <CardContent className="p-0">
                  <div className="aspect-square flex flex-col items-center justify-center gap-3 px-3">
                    <div className="ui-fine text-center leading-snug line-clamp-3">{g.label}</div>
                    <div className="ui-accentCircle">{g.credits}</div>
                    <div className="ui-fine text-center">Tocca per fissare</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </Spot>
    </MockChrome>
  );
}

const WEEK_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function CalendarScene() {
  // Giugno 2026 (lunedì-first, come MonthCalendar)
  const year = 2026;
  const monthIndex = 5;
  const firstOfMonth = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (firstOfMonth.getDay() + 6) % 7;
  const booked = new Set([8, 9, 10, 17, 23]);

  const cells: Array<number | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <MockChrome>
      {/* Griglia calendario (come MonthCalendar) */}
      <Spot id="calendar-grid">
        <section className="ui-card ui-cardContent">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="ui-h2">Calendario</div>
              <div className="ui-muted mt-1 capitalize">giugno 2026</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="ui-btn ui-clickableDay ui-minw0 h-[52px] w-[56px] px-0 flex items-center justify-center">←</span>
              <span className="ui-btn ui-clickableDay ui-minw0 h-[52px] w-[56px] px-0 flex items-center justify-center">→</span>
            </div>
          </div>

          <div
            className="mt-4 grid grid-cols-7 gap-2 ui-muted"
            style={{ fontWeight: 'var(--font-weight-semibold)' }}
          >
            {WEEK_LABELS.map((d) => (
              <div key={d} className="text-center">{d}</div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {cells.map((day, idx) => {
              const isEmpty = day === null;
              const hasEvents = !isEmpty && booked.has(day);
              return (
                <div
                  key={idx}
                  className={`ui-minw0 ui-clickableDay ui-clickableDayCell h-[52px] w-full flex items-center justify-center ${
                    isEmpty ? 'border-transparent bg-transparent' : ''
                  }`}
                >
                  <div className="flex flex-col items-center justify-center leading-none">
                    <div className="text-sm font-[var(--font-weight-bold)]">{day ?? ''}</div>
                    {!isEmpty ? (
                      <div
                        className="mt-1"
                        style={{
                          height: 4,
                          width: 18,
                          borderRadius: 999,
                          background: hasEvents ? 'var(--brand-accent)' : 'transparent',
                          opacity: hasEvents ? 0.95 : 0,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </Spot>

      {/* Prossime prenotazioni + saldo totale in fondo */}
      <Spot id="calendar-saldo">
        <section className="space-y-3">
          <div className="ui-h2">Prenotazioni</div>
          <Card>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="ui-body font-[var(--font-weight-semibold)]">Pensione · Rocky</div>
                <div className="ui-muted">08/06/2026 → 10/06/2026</div>
              </div>
              <div className="ui-accentPill">€ 90</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="ui-body font-[var(--font-weight-semibold)]">Addestramento · Rocky</div>
                <div className="ui-muted">17/06/2026</div>
              </div>
              <div className="ui-accentPill">€ 30</div>
            </CardContent>
          </Card>
          {/* il prezzo nella card è del singolo servizio; il saldo totale è in fondo */}
          <div className="ui-accentPill ui-accentPill--saldo w-full justify-center py-3 text-center font-[var(--font-weight-bold)]">
            Saldo: € 120,00
          </div>
        </section>
      </Spot>
    </MockChrome>
  );
}

function ChatBubble({ mine, text }: { mine?: boolean; text: string }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2 ui-body ${
          mine ? 'bg-[var(--brand-accent)] text-[#0c0f0e]' : 'bg-[var(--surface-2)] text-[var(--text)]'
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function ChatScene() {
  return (
    <MockChrome title="Chat">
      <Spot id="chat-area">
        <Card>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <ChatBubble text="Ciao! Come possiamo aiutarti? 🐾" />
              <ChatBubble mine text="Vorrei info sulla pensione per il weekend." />
              <ChatBubble text="Certo! Per quante notti e per quale cane?" />
            </div>
            <div className="flex items-center gap-2">
              <div className="ui-input flex-1 text-[var(--muted)]">Scrivi un messaggio…</div>
              <div className="ui-btn ui-btnTone-primary px-4">Invia</div>
            </div>
          </CardContent>
        </Card>
      </Spot>
    </MockChrome>
  );
}

function SettingsRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="ui-selectCard">
      <div className="space-y-1 text-left">
        <div className="ui-body font-[var(--font-weight-semibold)]">{title}</div>
        <div className="ui-muted">{subtitle}</div>
      </div>
    </div>
  );
}

function SettingsScene() {
  return (
    <MockChrome title="Impostazioni">
      <Spot id="settings-list">
        <div className="space-y-3">
          <div>
            <h1 className="ui-title">Impostazioni</h1>
            <p className="ui-muted">Gestisci account, documenti e preferenze.</p>
          </div>
          <Card>
            <CardContent className="space-y-2">
              <SettingsRow title="Dati e documenti" subtitle="Documento, liberatoria e dati personali." />
              <SettingsRow title="Modifica password" subtitle="Aggiorna la password dell’account." />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2">
              <SettingsRow title="Preferenze notifiche" subtitle="Scegli quali aggiornamenti ricevere." />
              <SettingsRow title="Rivedi il tutorial" subtitle="Riguarda questa introduzione quando vuoi." />
            </CardContent>
          </Card>
        </div>
      </Spot>
    </MockChrome>
  );
}

function BrandScene() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-10">
      <img
        src="/tenuta-logo.png"
        alt="Tenuta del Barone"
        className="h-40 w-40 rounded-full object-contain opacity-40"
        draggable={false}
      />
    </div>
  );
}

export function TutorialScene({ scene }: { scene: SceneKey }) {
  switch (scene) {
    case 'profile':
      return <ProfileScene />;
    case 'dog':
      return <DogScene />;
    case 'services':
      return <ServicesScene />;
    case 'calendar':
      return <CalendarScene />;
    case 'chat':
      return <ChatScene />;
    case 'settings':
      return <SettingsScene />;
    case 'intro':
    case 'outro':
    default:
      return <BrandScene />;
  }
}
