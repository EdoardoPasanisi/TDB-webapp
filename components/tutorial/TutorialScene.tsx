'use client';

/* eslint-disable @next/next/no-img-element */

import QRCode from 'react-qr-code';
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

/* ---------- Helpers UI mock ---------- */

function Spot({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-spot={id} className={className}>
      {children}
    </div>
  );
}

function SceneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 space-y-4">{children}</div>
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

/* ---------- Scene ---------- */

function ProfileScene() {
  return (
    <SceneShell>
      {/* Banner dati personali */}
      <Spot id="account">
        <div className="ui-profileHero md:rounded-[calc(var(--radius-xl)+4px)]">
          <div className="px-4 pb-5 pt-4">
            <div className="flex items-center gap-3">
              <DemoAvatar initials="MR" />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-extrabold truncate">Marco Rossi</div>
                <div className="ui-note ui-profileHeroMuted truncate">marco.rossi@email.it</div>
                <div className="mt-1 ui-fine ui-profileHeroMuted">
                  Dati, documenti e liberatoria
                </div>
              </div>
              <Chevron />
            </div>
          </div>
        </div>
      </Spot>

      {/* Indirizzo / contatti */}
      <Spot id="address">
        <Card>
          <CardContent className="space-y-2">
            <div className="ui-panelInset p-3">
              <p className="ui-muted">Telefono</p>
              <p className="ui-body mt-1">+39 333 1234567</p>
            </div>
            <div className="ui-panelInset p-3">
              <p className="ui-muted">Indirizzo</p>
              <p className="ui-body mt-1">Via Roma 10, 73100 Lecce (LE)</p>
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
    </SceneShell>
  );
}

function DogScene() {
  const sampleUrl = 'https://tenutadelbarone.app/dogs/card/rocky-demo';
  return (
    <SceneShell>
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
    </SceneShell>
  );
}

function ServiceTile({ title, icon }: { title: string; icon: string }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="aspect-square flex flex-col items-center justify-center gap-3 px-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-2xl">
            {icon}
          </div>
          <div className="ui-body font-[var(--font-weight-semibold)] leading-tight">{title}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ServicesScene() {
  return (
    <SceneShell>
      <Spot id="services-grid">
        <section className="space-y-3">
          <div>
            <h2 className="ui-title text-[26px]">Servizi</h2>
            <p className="ui-muted">Scegli un servizio per prenotare</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ServiceTile title="Pensione" icon="🏠" />
            <ServiceTile title="Asilo" icon="🦴" />
            <ServiceTile title="Addestramento" icon="🎓" />
            <ServiceTile title="Consulenza" icon="💬" />
          </div>
        </section>
      </Spot>
    </SceneShell>
  );
}

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

function CalendarScene() {
  const days = Array.from({ length: 35 }, (_, i) => i - 2); // offset start
  const booked = new Set([8, 9, 10, 17, 23]);
  return (
    <SceneShell>
      <Spot id="calendar-grid">
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="ui-body font-[var(--font-weight-semibold)]">Giugno 2026</span>
              <div className="ui-accentPill">Saldo: € 120,00</div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((d, i) => (
                <div key={i} className="ui-fine text-[var(--muted)] py-1">
                  {d}
                </div>
              ))}
              {days.map((d, i) => {
                const valid = d >= 1 && d <= 30;
                const isBooked = valid && booked.has(d);
                return (
                  <div
                    key={i}
                    className={`flex aspect-square items-center justify-center rounded-lg text-sm ${
                      isBooked
                        ? 'bg-[var(--brand-accent)] text-[#0c0f0e] font-[var(--font-weight-bold)]'
                        : valid
                          ? 'bg-[var(--surface-2)] text-[var(--text)]'
                          : 'opacity-0'
                    }`}
                  >
                    {valid ? d : ''}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </Spot>

      <Spot id="calendar-list">
        <section className="space-y-2">
          <h3 className="ui-body font-[var(--font-weight-semibold)]">Prossime prenotazioni</h3>
          <Card>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="ui-body font-[var(--font-weight-semibold)]">Pensione · Rocky</div>
                <div className="ui-muted">8 – 10 giugno</div>
              </div>
              <div className="ui-accentPill">€ 90</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="ui-body font-[var(--font-weight-semibold)]">Addestramento · Rocky</div>
                <div className="ui-muted">17 giugno</div>
              </div>
              <div className="ui-accentPill">€ 30</div>
            </CardContent>
          </Card>
        </section>
      </Spot>
    </SceneShell>
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
    <SceneShell>
      <div>
        <h1 className="ui-title">Impostazioni</h1>
        <p className="ui-muted">Gestisci account, documenti e preferenze.</p>
      </div>
      <Spot id="settings-list">
        <div className="space-y-3">
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
    </SceneShell>
  );
}

function ChatBubble({ mine, text }: { mine?: boolean; text: string }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2 ui-body ${
          mine
            ? 'bg-[var(--brand-accent)] text-[#0c0f0e]'
            : 'bg-[var(--surface-2)] text-[var(--text)]'
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function ChatScene() {
  return (
    <SceneShell>
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
    </SceneShell>
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
    case 'settings':
      return <SettingsScene />;
    case 'chat':
      return <ChatScene />;
    case 'intro':
    case 'outro':
    default:
      return <BrandScene />;
  }
}
