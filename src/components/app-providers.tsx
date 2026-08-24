'use client';

import { MotionConfig } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { SupabaseRepository } from '@/data/supabase-repository';
import type { HouseholdData } from '@/domain/types';
import { createClient } from '@/lib/supabase/client';
import { SemillaProvider } from '@/state/semilla-provider';

/**
 * Puente entre el servidor y el cliente.
 *
 * El primer snapshot llega ya renderizado desde el Server Component (rápido y
 * sin parpadeo). A partir de ahí manda el cliente de navegador: es quien escribe,
 * quien escucha Realtime y quien mantiene la sesión viva.
 */
export function AppProviders({
  initialData,
  currentUserId,
  children,
}: {
  initialData: HouseholdData;
  currentUserId: string;
  children: ReactNode;
}) {
  const repository = useMemo(() => new SupabaseRepository(createClient()), []);

  return (
    /* `reducedMotion="user"` hace que Framer respete la preferencia del sistema.
       El CSS ya frenaba las animaciones declarativas, pero las de JavaScript
       seguían moviéndose: para quien marea el movimiento, eso no es un detalle. */
    <MotionConfig reducedMotion="user">
      <SemillaProvider repository={repository} initialData={initialData} currentUserId={currentUserId}>
        <AppShell>{children}</AppShell>
      </SemillaProvider>
    </MotionConfig>
  );
}
