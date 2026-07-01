// FILE: components/ui/BottomNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

type BottomNavProps = {
  chatHref: string;
  homeHref: string;
  calendarHref: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function BottomNav({ chatHref, homeHref, calendarHref }: BottomNavProps) {
  const pathname = usePathname();

  const isChatActive = pathname === chatHref || pathname.startsWith(chatHref + '/');
  const isHomeActive = pathname === homeHref || pathname.startsWith(homeHref + '/');
  const isCalendarActive = pathname === calendarHref || pathname.startsWith(calendarHref + '/');

  return (
    <nav data-app-chrome="mobile-bottom" className="md:hidden fixed bottom-0 inset-x-0 z-40">
      <div className="ui-bottomNavShell">
        <div className="ui-bottomNavRow relative mx-auto flex h-[74px] w-full max-w-xl items-center justify-between px-8">
          <Link
            href={chatHref}
            className={cx('ui-bottomNavActionBtn', isChatActive && 'ui-bottomNavActionBtn--active')}
            aria-label="Chat"
          >
            <IconChat />
            <span className="ui-bottomNavActionBtn__label">Chat</span>
          </Link>

          <div className="w-[86px]" aria-hidden="true" />

          <Link
            href={calendarHref}
            className={cx('ui-bottomNavActionBtn', isCalendarActive && 'ui-bottomNavActionBtn--active')}
            aria-label="Calendario"
          >
            <IconCalendar />
            <span className="ui-bottomNavActionBtn__label">Calendario</span>
          </Link>

          <Link
            href={homeHref}
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
                className="h-[62px] w-[62px] object-contain rounded-full"
                draggable={false}
              />
            </div>
          </Link>
        </div>
      </div>
    </nav>
  );
}
