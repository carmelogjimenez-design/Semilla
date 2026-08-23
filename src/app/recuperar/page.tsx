import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth/auth-shell';
import { RecoverForm } from './recover-form';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function RecoverPage() {
  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle="Te enviamos un enlace para elegir una nueva."
      footer={
        <Link href="/entrar" className="font-semibold text-forest underline underline-offset-4">
          Volver a entrar
        </Link>
      }
    >
      <RecoverForm />
    </AuthShell>
  );
}
