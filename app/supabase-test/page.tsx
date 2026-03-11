'use client';
// Diciamo a Next che questo componente gira lato client (browser)

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SupabaseTestPage() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setResult(null);
    setError(null);

    // Facciamo una chiamata molto semplice:
    // chiediamo a Supabase se l'utente è loggato oppure no.
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setError(error.message);
    } else {
      setResult(JSON.stringify(data, null, 2));
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Test connessione Supabase</h1>

      <button
        onClick={handleTest}
        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        Testa Supabase
      </button>

      {result && (
        <pre className="bg-gray-100 p-4 rounded text-sm max-w-xl overflow-x-auto">
          {result}
        </pre>
      )}

      {error && (
        <p className="text-red-600">
          Errore: {error}
        </p>
      )}
    </main>
  );
}
