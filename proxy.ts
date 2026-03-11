// FILE: middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Rotte pubbliche (non richiedono login)
const PUBLIC_PATHS = new Set<string>([
  '/',
  '/login',
  '/signup',
  '/signup/check-email',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/cookies',
  '/auth/callback', // è il callback email: deve essere pubblico
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;

  // Static/next internals
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/favicon')) return true;
  if (pathname.startsWith('/public')) return true;

  // Pagina pubblica tag cane (QR)
  if (pathname.startsWith('/dogs/tag/')) return true;

  return false;
}

export async function proxy(request: NextRequest) {
  // Response “prossima”
  const response = NextResponse.next({ request: { headers: request.headers } });

  // Se è una pagina pubblica → lascia passare
  if (isPublicPath(request.nextUrl.pathname)) {
    return response;
  }

  // Crea server client che legge/scrive cookie sulla response
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Legge utente dal server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1) Non loggato → login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // 2) Loggato ma email NON confermata → check-email
  // (Supabase usa email_confirmed_at; fallback a confirmed_at)
  const userWithLegacyConfirmedAt = user as User & { confirmed_at?: string | null };
  const emailConfirmedAt = userWithLegacyConfirmedAt.email_confirmed_at ?? userWithLegacyConfirmedAt.confirmed_at;
  const isVerified = Boolean(emailConfirmedAt);

  if (!isVerified) {
    // Logout server-side: elimina cookie session
    await supabase.auth.signOut();

    const url = request.nextUrl.clone();
    url.pathname = '/signup/check-email';
    if (user.email) url.searchParams.set('email', user.email);
    return NextResponse.redirect(url);
  }

  return response;
}

// Applica a tutte le rotte tranne static/next internals
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
