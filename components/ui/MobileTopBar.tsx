// FILE: components/ui/MobileTopBar.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/Button';

export function MobileTopBar() {
  const router = useRouter();
  const pathname = usePathname();

  // /profile usa la stessa topbar delle altre pagine principali (impostazioni +
  // notifiche a sinistra, titolo al centro) ma SENZA il tasto "Profilo" a destra,
  // perché siamo già nella pagina profilo.
  const isProfile = pathname === '/profile';

  const isMainMobilePage =
    pathname === '/services' ||
    pathname === '/services/calendar' ||
    isProfile;

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
        <div className="ui-topbarSide ui-topbarSide--left">
          {isMainMobilePage ? (
            <>
              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="ui-topbarIconBtn"
                aria-label="Impostazioni"
              >
                <Image src="/icon-settings.png" alt="" width={24} height={24} className="h-6 w-6" draggable={false} />
              </button>
              <NotificationBell
                buttonClassName="ui-topbarIconBtn"
                panelClassName="ui-notificationPanel--mobile"
              />
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={handleBack}
              className="ui-topbarBackBtn ui-btnTone-ghostOnAccent"
            >
              ← Indietro
            </Button>
          )}
        </div>

        <div className="ui-topbarTitle">Tenuta del Barone</div>

        <div className="ui-topbarSide ui-topbarSide--right">
          {!isMainMobilePage ? (
            <NotificationBell
              buttonClassName="ui-topbarIconBtn"
              panelClassName="ui-notificationPanel--mobile"
            />
          ) : null}

          {!isProfile ? (
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="ui-topbarIconBtn"
              aria-label="Profilo"
            >
              <Image src="/icon-user.png" alt="" width={24} height={24} className="h-6 w-6" draggable={false} />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
