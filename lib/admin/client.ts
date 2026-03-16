'use client';

export async function fetchAdminJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = 'Errore richiesta gestionale.';

    try {
      const json = (await response.clone().json()) as { error?: string };
      if (json?.error) message = json.error;
    } catch {}

    if (message === 'Errore richiesta gestionale.') {
      try {
        const text = await response.text();
        if (text.trim()) message = text.trim();
      } catch {}
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
