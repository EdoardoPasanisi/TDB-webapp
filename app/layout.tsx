// FILE: app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/lib/auth/AuthProvider";

export const metadata: Metadata = {
  title: "Tenuta del Barone",
  description: "Gestione clienti, cani e prenotazioni",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className="antialiased min-h-screen bg-[var(--brand-bg)] text-[var(--text)]"
        style={{
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        }}
      >
        <AuthProvider>
          <Navbar />

          {/* 
            Mobile-first:
            - spazio per topbar fisso
            - spazio per bottom nav fisso
            Desktop:
            - topbar/bottomnav non mostrati, padding più classico
          */}
          <main className="px-4 pt-[calc(var(--topbar-h)+12px)] pb-[calc(var(--bottom-nav-h)+var(--safe-bottom)+12px)] md:pt-6 md:pb-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
