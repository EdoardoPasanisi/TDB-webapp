'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/lib/auth/AuthProvider';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { MobileTopBar } from '@/components/ui/MobileTopBar';
import { BottomNav } from '@/components/ui/BottomNav';
import { BackButton } from '@/components/common/BackButton';

function isMainRoute(pathname: string) {
  return (
    pathname === '/services' ||
    pathname === '/services/calendar' ||
    pathname === '/profile' ||
    pathname === '/chat'
  );
}

function isAuthRoute(pathname: string) {
  return (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/signup/') ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/auth/')
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading } = useAuthContext();
  const hideNavbarForRoute =
    pathname.startsWith('/dogs/card/') ||
    pathname.startsWith('/admin') ||
    isAuthRoute(pathname);
  const showMobileChrome = !loading && !!user && !hideNavbarForRoute;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.dataset.mobileChrome = showMobileChrome ? 'on' : 'off';
    document.body.dataset.desktopChrome = showMobileChrome ? 'on' : 'off';
    if (showMobileChrome && pathname === '/profile') {
      document.body.dataset.profileLayout = 'overview';
    } else {
      delete document.body.dataset.profileLayout;
    }
  }, [pathname, showMobileChrome]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    return () => {
      document.body.dataset.mobileChrome = 'off';
      document.body.dataset.desktopChrome = 'off';
      delete document.body.dataset.profileLayout;
      delete document.body.dataset.desktopBack;
    };
  }, []);

  const isCalendarActive =
    pathname === '/services/calendar' || pathname.startsWith('/services/calendar/');
  const isServicesActive =
    pathname === '/services' ||
    (pathname.startsWith('/services/') && !isCalendarActive);
  const isSettingsActive = pathname === '/settings' || pathname.startsWith('/settings/');
  const isProfileActive = pathname === '/profile';
  const isChatActive = pathname === '/chat' || pathname.startsWith('/chat/');
  const showDesktopBack = !isMainRoute(pathname);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!user || hideNavbarForRoute) {
      delete document.body.dataset.desktopBack;
      return;
    }

    document.body.dataset.desktopBack = showDesktopBack ? 'on' : 'off';
  }, [hideNavbarForRoute, showDesktopBack, user]);

  if (loading) return null;
  if (hideNavbarForRoute) return null;
  if (!user) return null;

  return (
    <>
      {/* MOBILE */}
      <MobileTopBar />
      <BottomNav chatHref="/chat" homeHref="/services" calendarHref="/services/calendar" />

      {/* DESKTOP */}
      <header data-app-chrome="desktop-top" className="hidden md:fixed md:inset-x-0 md:top-0 md:z-50 md:block">
        <div className="ui-desktopTopShell">
          <nav className="mx-auto grid max-w-[1400px] grid-cols-[auto_1fr_auto] items-center gap-10 px-8 py-3">
            <Link href="/services" className="ml-8 flex items-center justify-center" aria-label="Vai ai servizi">
              <Image
                src="/tenuta-logo.png"
                alt="Tenuta del Barone"
                width={168}
                height={52}
                priority
                className="h-[44px] w-auto"
              />
            </Link>

            <div className="flex items-center justify-center gap-5 text-sm">
              <Link
                href="/services"
                className={`ui-navLinkBtn ${isServicesActive ? 'ui-navLinkBtn--active' : ''}`}
              >
                Servizi
              </Link>

              <Link
                href="/services/calendar"
                className={`ui-navLinkBtn ${isCalendarActive ? 'ui-navLinkBtn--active' : ''}`}
              >
                Calendario
              </Link>

              <Link
                href="/chat"
                className={`ui-navLinkBtn ${isChatActive ? 'ui-navLinkBtn--active' : ''}`}
              >
                Chat
              </Link>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Link
                href="/settings"
                className={`ui-desktopTopIconBtn ${isSettingsActive ? 'ui-desktopTopIconBtn--active' : ''}`}
                aria-label="Impostazioni"
              >
                <Image src="/icon-settings.png" alt="" width={24} height={24} className="h-6 w-6" draggable={false} />
              </Link>

              <NotificationBell
                buttonClassName="ui-desktopTopIconBtn"
                panelClassName="ui-notificationPanel--desktop"
              />

              <Link
                href="/profile"
                className={`ui-desktopTopIconBtn ${isProfileActive ? 'ui-desktopTopIconBtn--active' : ''}`}
                aria-label="Profilo"
              >
                <Image src="/icon-user.png" alt="" width={24} height={24} className="h-6 w-6" draggable={false} />
              </Link>
            </div>
          </nav>
        </div>

        {showDesktopBack ? (
          <div className="mx-auto max-w-[1400px] px-8 pt-4">
            <BackButton hrefFallback="/services" />
          </div>
        ) : null}
      </header>
    </>
  );
}
