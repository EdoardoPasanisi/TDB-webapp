'use client';

import type { ReactNode } from 'react';
import { AuthenticatedAppChrome } from '@/components/AuthenticatedAppChrome';
import { usePathname } from 'next/navigation';

function isPublicShellPath(pathname: string): boolean {
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/signup/') ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/auth/')
  ) {
    return true;
  }

  if (pathname === '/privacy' || pathname === '/terms' || pathname === '/cookies') {
    return true;
  }

  if (pathname.startsWith('/dogs/card/')) return true;

  return false;
}

export function AppChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';

  if (isPublicShellPath(pathname)) {
    return <>{children}</>;
  }

  return <AuthenticatedAppChrome>{children}</AuthenticatedAppChrome>;
}
