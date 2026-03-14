'use client';
// Diciamo a Next che questo componente gira lato client (browser)

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';

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
    <main className="ui-page min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="ui-title">Test connessione Supabase</h1>

      <Button type="button" variant="primary" onClick={handleTest} className="h-11 px-4">
        Testa Supabase
      </Button>

      {result && (
        <pre className="ui-codeBlock">
          {result}
        </pre>
      )}

      {error && (
        <p className="ui-dangerText">
          Errore: {error}
        </p>
      )}
    </main>
  );
}
