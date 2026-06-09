'use client';

import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { TutorialProvider } from '@/components/tutorial/TutorialProvider';

export function AuthenticatedAppChrome({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TutorialProvider>
        <Navbar />
        {children}
      </TutorialProvider>
    </AuthProvider>
  );
}
