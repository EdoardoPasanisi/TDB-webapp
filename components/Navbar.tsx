'use client';

import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuthContext } from '@/lib/auth/AuthProvider';
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

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuthContext();

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
  if (!user) return null;
  if (pathname.startsWith('/dogs/card/')) return null;

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
        <div className="bg-[var(--brand-bg)] text-[var(--text)] border-b border-[var(--border)]">
          <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
            <button onClick={() => router.push('/profile')} className="text-lg font-bold">
              Tenuta del Barone
            </button>

            <div className="flex items-center gap-3 text-sm">
              <button
                onClick={() => router.push('/profile')}
                className={`px-3 py-2 rounded-[var(--radius)] hover:bg-[rgba(255,255,255,0.06)] ${
                  pathname === '/profile' ? 'bg-[rgba(255,255,255,0.06)]' : ''
                }`}
              >
                Profilo
              </button>

              <button
                onClick={() => router.push('/services')}
                className={`px-3 py-2 rounded-[var(--radius)] hover:bg-[rgba(255,255,255,0.06)] ${
                  isServicesActive ? 'bg-[rgba(255,255,255,0.06)]' : ''
                }`}
              >
                Servizi
              </button>

              <button
                onClick={() => router.push('/settings')}
                className={`px-3 py-2 rounded-[var(--radius)] hover:bg-[rgba(255,255,255,0.06)] ${
                  isSettingsActive ? 'bg-[rgba(255,255,255,0.06)]' : ''
                }`}
              >
                Impostazioni
              </button>

              <button
                onClick={handleLogout}
                className="px-4 h-11 rounded-[var(--radius)] bg-[var(--brand-accent)] text-black font-semibold hover:opacity-90"
              >
                Logout
              </button>
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
