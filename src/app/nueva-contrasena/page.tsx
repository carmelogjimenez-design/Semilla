import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/auth-shell';
import { NewPasswordForm } from './new-password-form';

export const metadata: Metadata = { title: 'Nueva contraseña' };

export default function NewPasswordPage() {
  return (
    <AuthShell title="Nueva contraseña" subtitle="Elige una que no uses en otro sitio.">
      <NewPasswordForm />
    </AuthShell>
  );
}
