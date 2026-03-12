// FILE: app/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[var(--brand-bg)]">
          <p className="ui-body text-[var(--muted)]">Caricamento…</p>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
