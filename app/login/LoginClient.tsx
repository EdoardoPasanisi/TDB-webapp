// FILE: app/login/LoginClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ⚠️ Nota: questo file replica la logica esistente del login.
// Se nel tuo page.tsx originale c'erano campi/messaggi extra, copiali qui identici.

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Errore inaspettato.";
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirectedFrom = useMemo(() => searchParams.get("redirectedFrom"), [searchParams]);
  const justVerified = useMemo(() => searchParams.get("verified"), [searchParams]);
  const reason = useMemo(() => searchParams.get("reason"), [searchParams]);

  useEffect(() => {
    // Manteniamo comportamento "informativo" (se già c'era).
    // Se non c'era, questa parte è innocua (solo UI).
    if (justVerified === "1") setMessage("Email verificata. Ora puoi accedere.");
    if (reason === "email_not_confirmed") setMessage("Conferma l’email per poter accedere.");
  }, [justVerified, reason]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      // Se avevi un redirect custom, lo manteniamo:
      const target = redirectedFrom || "/profile";
      // Dopo login con cookie-based SSR, spesso conviene refresh del router:
      router.replace(target);
      router.refresh();

      // opzionale: data session non usata
      void data;
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Accedi</h1>

      {message && <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            className="h-11 rounded-lg border border-gray-300 bg-white px-3"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            className="h-11 rounded-lg border border-gray-300 bg-white px-3"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button
          className="mt-2 h-11 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? "Accesso…" : "Accedi"}
        </button>

        <div className="mt-2 flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-gray-700 underline"
            onClick={() => router.push("/signup")}
          >
            Crea account
          </button>

          <button
            type="button"
            className="text-gray-700 underline"
            onClick={() => router.push("/forgot-password")}
          >
            Password dimenticata?
          </button>
        </div>
      </form>
    </div>
  );
}
