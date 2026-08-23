import { NextResponse, type NextRequest } from 'next/server';

import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Punto de retorno de los enlaces de correo de Supabase (confirmación,
 * recuperación, magic link). Cambia el código por una sesión y sigue camino.
 *
 * No asume un dominio fijo: usa el origen de la propia petición, de modo que
 * funciona en localhost, en los preview de Vercel y en producción (§44).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('siguiente') ?? searchParams.get('next') ?? '/';
  const safeNext = next.startsWith('/') ? next : '/';

  const supabase = await createServerSupabase();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'email' | 'recovery' | 'invite' | 'email_change',
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }

  return NextResponse.redirect(
    `${origin}/entrar?mensaje=${encodeURIComponent('El enlace ha caducado. Pide otro.')}`,
  );
}
