import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string; mensaje?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Entrar"
      subtitle="Vuestra economía, en el mismo sitio, desde cualquier móvil."
      footer={
        <>
          ¿Aún no tenéis cuenta?{' '}
          <Link href="/crear-cuenta" className="font-semibold text-forest underline underline-offset-4">
            Crear cuenta
          </Link>
        </>
      }
    >
      <LoginForm next={params.siguiente ?? '/'} notice={params.mensaje ?? null} />
    </AuthShell>
  );
}
