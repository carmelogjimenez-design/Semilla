import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseAnonKey, supabaseUrl } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Cliente de servidor para Server Components, Server Actions y Route Handlers.
 * Se crea uno por petición porque va atado a las cookies de esa petición.
 */
export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies: el middleware ya
          // refresca la sesión antes de llegar aquí.
        }
      },
    },
  });
}
