import { redirect } from 'next/navigation';

import { AppProviders } from '@/components/app-providers';
import { SupabaseRepository } from '@/data/supabase-repository';
import { getSessionContext } from '@/lib/session';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Guarda de las rutas privadas (§20) y carga inicial del hogar.
 *
 * Sin sesión → /entrar. Con sesión pero sin hogar → /bienvenida.
 * El middleware ya ha refrescado el token antes de llegar aquí.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();
  if (!session) redirect('/entrar');
  if (!session.householdId) redirect('/bienvenida');

  const supabase = await createServerSupabase();
  const repository = new SupabaseRepository(supabase);
  const initialData = await repository.load(session.householdId);

  return (
    <AppProviders initialData={initialData} currentUserId={session.userId}>
      {children}
    </AppProviders>
  );
}
