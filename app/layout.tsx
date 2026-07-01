// FILE: app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppChromeGate } from '@/components/AppChromeGate';

export const metadata: Metadata = {
  title: 'Tenuta del Barone',
  description: 'Gestione clienti, pet e prenotazioni',
  applicationName: 'Tenuta del Barone',
  manifest: '/manifest.webmanifest',
  robots: {
    index: false,
    follow: false,
  },
  appleWebApp: {
    capable: true,
    title: 'Tenuta del Barone',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#060807',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <head>
        {/* Marca il contesto nativo (WebView Capacitor) PRIMA del primo paint, così
            gli override `.native-app` in globals.css non producono flash. Nei browser
            lo user-agent non contiene 'TDBApp' → la classe non viene mai aggiunta. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(navigator.userAgent.indexOf('TDBApp')>-1){document.documentElement.classList.add('native-app');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="antialiased ui-page">
        <AppChromeGate>
          <main className="ui-appMain">{children}</main>
        </AppChromeGate>
      </body>
    </html>
  );
}
