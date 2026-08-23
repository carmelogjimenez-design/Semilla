'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button, Field, TextInput } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';

export function NewPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (authError) {
      setError('No hemos podido cambiarla. Vuelve a pedir el enlace.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
        <TextInput
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
      </Field>
      {error ? <p className="text-[13px] font-medium text-coral-deep">{error}</p> : null}
      <Button type="submit" full disabled={loading}>
        {loading ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}
