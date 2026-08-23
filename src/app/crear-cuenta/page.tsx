import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth/auth-shell';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invitacion?: string; correo?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle={
        params.invitacion
          ? 'Crea tu cuenta y entrarás directamente en el hogar al que te han invitado.'
          : 'Cada persona entra con su propio correo. La economía es compartida.'
      }
      footer={
        <>
          ¿Ya tenéis cuenta?{' '}
          <Link href="/entrar" className="font-semibold text-forest underline underline-offset-4">
            Entrar
          </Link>
        </>
      }
    >
      <RegisterForm inviteToken={params.invitacion ?? null} presetEmail={params.correo ?? null} />
    </AuthShell>
  );
}
