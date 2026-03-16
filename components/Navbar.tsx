'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuthContext } from '@/lib/auth/AuthProvider';
import { MobileTopBar } from '@/components/ui/MobileTopBar';
import { BottomNav } from '@/components/ui/BottomNav';
import { BackButton } from '@/components/common/BackButton';
import { Button } from '@/components/ui/Button';

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
  const router = useRouter();
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
  }, [showMobileChrome]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    return () => {
      document.body.dataset.mobileChrome = 'off';
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('sb-access-token');
          localStorage.removeItem('sb-refresh-token');
        } catch {}
      }
      router.push('/login');
      router.refresh();
    }
  };

  if (loading) return null;
  if (hideNavbarForRoute) return null;
  if (!user) return null;

  const isServicesActive = pathname === '/services' || pathname.startsWith('/services/');
  const isSettingsActive = pathname === '/settings' || pathname.startsWith('/settings/');
  const showDesktopBack = !isMainRoute(pathname);

  return (
    <>
      {/* MOBILE */}
      <MobileTopBar />
      <BottomNav homeHref="/services" calendarHref="/services/calendar" />

      {/* DESKTOP */}
      <header data-app-chrome="desktop-top" className="hidden md:block">
        <div className="ui-desktopTopShell">
          <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
            <button onClick={() => router.push('/profile')} className="text-lg font-black">
              Tenuta del Barone
            </button>

            <div className="flex items-center gap-3 text-sm">
              <button
                onClick={() => router.push('/profile')}
                className={`ui-navLinkBtn ${
                  pathname === '/profile' ? 'ui-navLinkBtn--active' : ''
                }`}
              >
                Profilo
              </button>

              <button
                onClick={() => router.push('/services')}
                className={`ui-navLinkBtn ${
                  isServicesActive ? 'ui-navLinkBtn--active' : ''
                }`}
              >
                Servizi
              </button>

              <button
                onClick={() => router.push('/settings')}
                className={`ui-navLinkBtn ${
                  isSettingsActive ? 'ui-navLinkBtn--active' : ''
                }`}
              >
                Impostazioni
              </button>

              <Button
                type="button"
                variant="primary"
                onClick={handleLogout}
                className="h-11 px-4"
              >
                Logout
              </Button>
            </div>
          </nav>
        </div>

        {showDesktopBack ? (
          <div className="max-w-6xl mx-auto px-6 pt-4">
            <BackButton hrefFallback="/services" />
          </div>
        ) : null}
      </header>
    </>
  );
}
