'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseAnonKey, supabaseUrl } from '@/lib/env';
import type { Database } from './database.types';

export type SemillaClient = SupabaseClient<Database>;

let browserClient: SemillaClient | null = null;

/**
 * Cliente de navegador. Uno solo por pestaña: comparte sesión, refresco de token
 * y canal de Realtime. Nunca se instancia dentro de un render.
 */
export function createClient(): SemillaClient {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return browserClient;
}
