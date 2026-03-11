// FILE: app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/profile', request.url));

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

  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  try {
    // PKCE flow: ?code=...
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else {
      // fallback token_hash flow (alcuni template)
      const token_hash = url.searchParams.get('token_hash');
      const type = url.searchParams.get('type') as
        | 'signup'
        | 'recovery'
        | 'invite'
        | 'magiclink'
        | 'email_change'
        | null;

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type });
        if (error) throw error;
      }
    }

    // ora utente deve esistere
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.redirect(new URL('/login?e=callback_session_invalid', request.url));
    }

    // ✅ CREA profilo SOLO DOPO conferma email (qui)
    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('profiles').insert({
        user_id: user.id,
        email: user.email ?? null,
      });
    }

    return response;
  } catch (e) {
    console.error('[auth callback route] error:', e);
    return NextResponse.redirect(new URL('/login?e=callback_failed', request.url));
  }
}
