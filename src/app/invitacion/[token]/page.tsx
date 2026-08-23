import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/primitives';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/session';
import { AcceptInvite } from './accept-invite';

export const metadata: Metadata = { title: 'Invitación' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabase();
  const [{ data: preview }, session] = await Promise.all([
    supabase.rpc('invite_preview', { p_token: token }),
    getSessionContext(),
  ]);

  const invite = Array.isArray(preview) ? preview[0] : null;

  if (!invite) {
    return (
      <AuthShell title="Invitación no encontrada" subtitle="Puede que el enlace esté incompleto.">
        <Link href="/entrar">
          <Button full variant="secondary">
            Ir a Semilla
          </Button>
        </Link>
      </AuthShell>
    );
  }

  if (invite.status === 'cancelled' || invite.status === 'expired' || invite.expired) {
    return (
      <AuthShell
        title="Esta invitación ya no vale"
        subtitle="Pídele a quien te invitó que te mande una nueva desde Más → Familia."
      >
        <Link href="/entrar">
          <Button full variant="secondary">
            Ir a Semilla
          </Button>
        </Link>
      </AuthShell>
    );
  }

  if (!session) {
    return (
      <AuthShell
        title={`Te han invitado a ${invite.household_name}`}
        subtitle={`La invitación es para ${invite.email}. Entra con ese correo o crea la cuenta.`}
        footer={
          <>
            ¿Ya tienes cuenta?{' '}
            <Link
              href={`/entrar?siguiente=${encodeURIComponent(`/invitacion/${token}`)}`}
              className="font-semibold text-forest underline underline-offset-4"
            >
              Entrar
            </Link>
          </>
        }
      >
        <Link
          href={`/crear-cuenta?invitacion=${encodeURIComponent(token)}&correo=${encodeURIComponent(invite.email)}`}
        >
          <Button full>Crear cuenta</Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Compartir ${invite.household_name}`}
      subtitle="A partir de ahora veréis exactamente los mismos números."
    >
      <AcceptInvite token={token} displayName={session.displayName} />
    </AuthShell>
  );
}
