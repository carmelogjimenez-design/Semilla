import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '../env';
import type { Database } from './database.types';

/** Rutas que se pueden ver sin sesión. */
const PUBLIC_PREFIXES = [
  '/entrar',
  '/crear-cuenta',
  '/recuperar',
  '/nueva-contrasena',
  '/invitacion',
  '/auth',
  '/configurar',
  '/preview',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Refresca la sesión en cada petición y protege las rutas privadas (§20).
 * Es lo primero que se ejecuta: sin esto, los Server Components verían tokens caducados.
 *
 * El middleware corre en el Edge y se ejecuta ANTES que cualquier página: si aquí
 * se lanza una excepción, la aplicación entera devuelve un 500 opaco. Por eso todo
 * va envuelto: ante cualquier fallo dejamos pasar la petición y que sea la propia
 * app quien explique el problema con palabras.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    if (pathname === '/configurar') return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = '/configurar';
    url.search = '';
    return NextResponse.redirect(url);
  }

  try {
    let response = NextResponse.next({ request });

    const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublic(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/entrar';
      url.search = '';
      url.searchParams.set('siguiente', pathname);
      return NextResponse.redirect(url);
    }

    if (user && (pathname === '/entrar' || pathname === '/crear-cuenta')) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }

    return response;
  } catch (error) {
    // Nunca tumbamos la app por un problema de sesión: se registra y se sigue.
    console.error('[semilla] el middleware no ha podido refrescar la sesión:', error);
    return NextResponse.next({ request });
  }
}
