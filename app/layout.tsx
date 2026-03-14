// FILE: app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/lib/auth/AuthProvider';

export const metadata: Metadata = {
  title: 'Tenuta del Barone',
  description: 'Gestione clienti, cani e prenotazioni',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased ui-page">
        <AuthProvider>
          <Navbar />

          {/* 
            Mobile-first:
            - spazio per topbar fisso
            - spazio per bottom nav fisso
            Desktop:
            - topbar/bottomnav non mostrati, padding più classico
          */}
          <main className="ui-appMain">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
