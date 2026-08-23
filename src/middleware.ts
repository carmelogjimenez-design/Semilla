import type { NextRequest } from 'next/server';

import { updateSession } from './lib/supabase/middleware';

/**
 * Se ejecuta antes que cualquier página: refresca la sesión de Supabase y
 * protege las rutas privadas.
 *
 * Vive dentro de `src/` porque el proyecto usa esa estructura, y usa imports
 * relativos a propósito: el Edge Runtime de Vercel no resuelve alias de
 * TypeScript al empaquetar el middleware.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Todo excepto estáticos, iconos y el service worker.
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.*\\.png|icon\\.svg|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
