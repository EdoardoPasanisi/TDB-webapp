import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getAuthRedirectBaseFromRequest } from '@/lib/auth/getAuthRedirectBase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const redirectBase = getAuthRedirectBaseFromRequest(request.url);
  const response = NextResponse.redirect(new URL('/reset-password', redirectBase));
  const url = new URL(request.url);

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

  const code = url.searchParams.get('code');
  const token_hash = url.searchParams.get('token_hash');

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (token_hash) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' });
      if (error) throw error;
    }

    return response;
  } catch (error) {
    console.error('[auth recovery route] error:', error);
    return NextResponse.redirect(new URL('/forgot-password?e=recovery_callback_failed', redirectBase));
  }
}
