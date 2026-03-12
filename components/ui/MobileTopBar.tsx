// FILE: components/ui/MobileTopBar.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

export function MobileTopBar() {
  const router = useRouter();
  const pathname = usePathname();

  // profilo (usa banner dedicato)
  if (pathname === '/profile') {
    return null;
  }

  const isMainMobilePage =
    pathname === '/services' ||
    pathname === '/services/calendar';

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/services');
  };

  return (
    <header data-app-chrome="mobile-top" className="md:hidden fixed top-0 inset-x-0 z-40">
      <div
        className="h-[var(--topbar-h)] px-4 flex items-center justify-between"
        style={{
          background: 'var(--brand-accent)',
          backdropFilter: 'none',
          borderBottom: '1px solid rgba(0,0,0,0.12)',
        }}
      >
        {/* SINISTRA: settings sulle main pages, altrimenti bottone indietro */}
        {isMainMobilePage ? (
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className="h-11 w-11 rounded-[var(--radius)] flex items-center justify-center text-black hover:bg-black/10"
            aria-label="Impostazioni"
          >
            <Image src="/icon-settings.png" alt="" width={24} height={24} className="h-6 w-6" draggable={false} />
          </button>
        ) : (
          <Button
            variant="ghost"
            onClick={handleBack}
            className="px-3 text-black hover:bg-black/10"
          >
            ← Indietro
          </Button>
        )}

        <div className="text-sm font-semibold text-black">Tenuta del Barone</div>

        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="h-11 w-11 rounded-[var(--radius)] flex items-center justify-center text-black hover:bg-black/10"
          aria-label="Profilo"
        >
          <Image src="/icon-user.png" alt="" width={24} height={24} className="h-6 w-6" draggable={false} />
        </button>
      </div>
    </header>
  );
}
