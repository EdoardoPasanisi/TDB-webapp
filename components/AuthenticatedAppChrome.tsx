'use client';

import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { TutorialProvider } from '@/components/tutorial/TutorialProvider';
import { NativePushRegistrar } from '@/components/native/NativePushRegistrar';

export function AuthenticatedAppChrome({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TutorialProvider>
        <NativePushRegistrar />
        <Navbar />
        {children}
      </TutorialProvider>
    </AuthProvider>
  );
}
