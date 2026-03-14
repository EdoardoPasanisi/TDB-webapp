// FILE: components/ui/BottomNav.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
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

  return (
    <nav data-app-chrome="mobile-bottom" className="md:hidden fixed bottom-0 inset-x-0 z-40">
      {/* ✅ Barra ATTACCATA al fondo + safe-area */}
      <div className="ui-bottomNavShell">
        {/* Contenuto barra */}
        <div className="relative mx-auto w-full max-w-xl h-[88px] px-5 flex items-center justify-between">
          {/* Chat (disabled) */}
          <button
            type="button"
            disabled
            className="ui-bottomNavActionBtn"
            aria-label="Chat (non disponibile)"
          >
            <IconChat />
            <span className="ui-bottomNavActionBtn__label">Chat</span>
          </button>

          {/* Spacer per il bottone centrale */}
          <div className="w-24" aria-hidden="true" />

          {/* Calendario */}
          <button
            type="button"
            onClick={() => router.push(calendarHref)}
            className={cx('ui-bottomNavActionBtn', isCalendarActive && 'ui-bottomNavActionBtn--active')}
            aria-label="Calendario"
          >
            <IconCalendar />
            <span className="ui-bottomNavActionBtn__label">Calendario</span>
          </button>

          {/* ✅ Bottone centrale floating (ma la barra resta attaccata) */}
          <button
            type="button"
            onClick={() => router.push(homeHref)}
            aria-label="Home"
            className="ui-bottomNavCenterTap absolute left-1/2 -translate-x-1/2 -top-9"
          >
            <div
              className={cx(
                'ui-bottomNavCenterBtn',
                isHomeActive && 'ui-bottomNavCenterBtn--active',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tenuta-logo.png"
                alt="Tenuta del Barone"
                className="h-[64px] w-[64px] object-contain rounded-full"
                draggable={false}
              />
            </div>
          </button>
        </div>
      </div>
    </nav>
  );
}
