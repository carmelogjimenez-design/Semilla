import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/primitives';
import { getSessionContext } from '@/lib/session';
import { createServerSupabase } from '@/lib/supabase/server';
import { OnboardingFlow } from './onboarding-flow';

export const metadata: Metadata = { title: 'Bienvenida' };

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const [session, params] = await Promise.all([getSessionContext(), searchParams]);
  if (!session) redirect('/entrar');
  if (session.householdId) redirect('/');

  /**
   * Antes de dejar crear un hogar, mirar si hay uno esperando.
   *
   * Quien llega aquí con una invitación pendiente casi nunca quiere una casa
   * nueva: quiere entrar en la de su pareja, y ha acabado aquí porque abrió la
   * app en vez del enlace. Crear el hogar sin preguntar deja a dos personas en
   * dos economías separadas sin que ninguna de las dos entienda por qué.
   */
  const supabase = await createServerSupabase();
  const { data: invites } = await supabase.rpc('my_pending_invites');
  const invite = Array.isArray(invites) ? invites[0] : null;

  if (invite && params.nuevo !== '1') {
    return (
      <AuthShell
        title={`Te han invitado a ${invite.household_name}`}
        subtitle="Entra ahí y veréis exactamente los mismos números. No hace falta que crees nada."
        footer={
          <Link href="/bienvenida?nuevo=1" className="font-semibold text-forest underline underline-offset-4">
            Prefiero crear un hogar nuevo
          </Link>
        }
      >
        <Link href={`/invitacion/${invite.token}`}>
          <Button full>Entrar en {invite.household_name}</Button>
        </Link>
      </AuthShell>
    );
  }

  return <OnboardingFlow displayName={session.displayName} />;
}
