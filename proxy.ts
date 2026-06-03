// proxy.ts — Next 16 middleware entry point (exported as "proxy")
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
  '/auth/recovery',
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;

  // Static/next internals
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/favicon')) return true;
  if (pathname.startsWith('/public')) return true;
  // Public assets from /public are served from root (e.g. /icon-pensione.png)
  if (/\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml|webmanifest|woff2?|ttf|eot)$/i.test(pathname)) {
    return true;
  }

  // Pagina pubblica tag cane (QR)
  if (pathname.startsWith('/dogs/tag/')) return true;
  // Scheda cane pubblica
  if (pathname.startsWith('/dogs/card/')) return true;

  return false;
}

function isApiPath(pathname: string) {
  return pathname.startsWith('/api/');
}

function hasBearerAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization') ?? '';
  return /^Bearer\s+\S+/i.test(authHeader);
}

function copyResponseCookies(source: NextResponse, target: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  return target;
}

export async function proxy(request: NextRequest) {
  // Response “prossima”
  const response = NextResponse.next({ request: { headers: request.headers } });
  const pathname = request.nextUrl.pathname;

  // Se è una pagina pubblica → lascia passare
  if (isPublicPath(pathname)) {
    return response;
  }

  if (isApiPath(pathname) && hasBearerAuth(request)) {
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

  // Legge utente dal server — in caso di errore di rete lascia passare anziché crashare
  let user: User | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase temporaneamente non raggiungibile: lasciamo passare la request.
    // Il page component farà il suo auth check e gestirà il caso no-session.
    return response;
  }

  // 1) Non loggato → login
  if (!user) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return copyResponseCookies(response, NextResponse.redirect(url));
  }

  // 2) Loggato ma email NON confermata → check-email
  // (Supabase usa email_confirmed_at; fallback a confirmed_at)
  const userWithLegacyConfirmedAt = user as User & { confirmed_at?: string | null };
  const emailConfirmedAt = userWithLegacyConfirmedAt.email_confirmed_at ?? userWithLegacyConfirmedAt.confirmed_at;
  const isVerified = Boolean(emailConfirmedAt);

  if (!isVerified) {
    // Logout server-side: elimina cookie session
    await supabase.auth.signOut();

    if (isApiPath(pathname)) {
      return copyResponseCookies(
        response,
        NextResponse.json({ error: 'Email non verificata.' }, { status: 403 })
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = '/signup/check-email';
    if (user.email) url.searchParams.set('email', user.email);
    return copyResponseCookies(response, NextResponse.redirect(url));
  }

  if (pathname.startsWith('/admin')) {
    const { data: staffAccess, error: staffError } = await supabase
      .from('staff_accounts')
      .select('role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (staffError || !staffAccess || staffAccess.is_active === false) {
      const url = request.nextUrl.clone();
      url.pathname = '/services';
      url.searchParams.set('admin', 'forbidden');
      return copyResponseCookies(response, NextResponse.redirect(url));
    }
  }

  return response;
}

// Applica a tutte le rotte tranne static/next internals
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml|webmanifest|woff2?|ttf|eot)$).*)',
  ],
};
