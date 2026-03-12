// FILE: components/ui/BottomNav.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 2v4M16 2v4" />
      <path d="M3 10h18" />
      <path d="M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </svg>
  );
}

type BottomNavProps = {
  homeHref: string;
  calendarHref: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function BottomNav({ homeHref, calendarHref }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isHomeActive = pathname === homeHref || pathname.startsWith(homeHref + '/');
  const isCalendarActive = pathname === calendarHref || pathname.startsWith(calendarHref + '/');

  // ✅ Dark style tokens
  //const barBg = 'rgba(6,8,7,0.96)'; // coerente col brand-bg, leggermente trasparente
  const barBg = 'rgba(255,130,0,1)';
  const barBorder = 'rgba(255,255,255,0.10)';
  const inactive = 'text-black/60';
  const active = 'text-black';

  return (
    <nav data-app-chrome="mobile-bottom" className="md:hidden fixed bottom-0 inset-x-0 z-40">
      {/* ✅ Barra ATTACCATA al fondo + safe-area */}
      <div
        className="relative"
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom) + 10px)`,
          background: barBg,
          backdropFilter: 'blur(12px)',
          borderTop: `1px solid ${barBorder}`,
        }}
      >
        {/* Contenuto barra */}
        <div className="relative mx-auto w-full max-w-xl h-[74px] px-6 flex items-center justify-between">
          {/* Chat (disabled) */}
          <button
            type="button"
            disabled
            className={cx('flex flex-col items-center justify-center gap-1 w-20', inactive, 'disabled:opacity-60')}
            aria-label="Chat (non disponibile)"
          >
            <IconChat />
            <span className="text-[11px] font-medium">Chat</span>
          </button>

          {/* Spacer per il bottone centrale */}
          <div className="w-20" aria-hidden="true" />

          {/* Calendario */}
          <button
            type="button"
            onClick={() => router.push(calendarHref)}
            className={cx('flex flex-col items-center justify-center gap-1 w-20', isCalendarActive ? active : inactive)}
            aria-label="Calendario"
          >
            <IconCalendar />
            <span className="text-[11px] font-medium">Calendario</span>
          </button>

          {/* ✅ Bottone centrale floating (ma la barra resta attaccata) */}
          <button
            type="button"
            onClick={() => router.push(homeHref)}
            aria-label="Home"
            className="absolute left-1/2 -translate-x-1/2 -top-7"
          >
            <div
              className={cx(
                'h-[74px] w-[74px] rounded-full flex items-center justify-center',
                isHomeActive && 'ring-2 ring-black/35 ring-offset-2 ring-offset-[var(--brand-accent)]',
              )}
              style={{
                // uniforme col logo se il logo ha fondo nero
                background: '#000',
                border: `3px solid var(--brand-accent)`,
                boxShadow: '0 18px 28px rgba(0,0,0,0.50)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tenuta-logo.png"
                alt="Tenuta del Barone"
                className="h-[54px] w-[54px] object-contain rounded-full"
                draggable={false}
              />
            </div>
          </button>
        </div>
      </div>
    </nav>
  );
}
