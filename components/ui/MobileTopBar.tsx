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
      <div className="ui-topbarShell">
        {/* SINISTRA: settings sulle main pages, altrimenti bottone indietro */}
        {isMainMobilePage ? (
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className="ui-topbarIconBtn"
            aria-label="Impostazioni"
          >
            <Image src="/icon-settings.png" alt="" width={24} height={24} className="h-6 w-6" draggable={false} />
          </button>
        ) : (
          <Button
            variant="ghost"
            onClick={handleBack}
            className="ui-topbarBackBtn ui-btnTone-ghostOnAccent"
          >
            ← Indietro
          </Button>
        )}

        <div className="ui-topbarTitle">Tenuta del Barone</div>

        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="ui-topbarIconBtn"
          aria-label="Profilo"
        >
          <Image src="/icon-user.png" alt="" width={24} height={24} className="h-6 w-6" draggable={false} />
        </button>
      </div>
    </header>
  );
}
