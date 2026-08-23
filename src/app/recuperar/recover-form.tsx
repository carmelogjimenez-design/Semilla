'use client';

import { useState, type FormEvent } from 'react';

import { Button, Field, TextInput } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { siteUrl } from '@/lib/env';

export function RecoverForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl()}/auth/callback?siguiente=/nueva-contrasena`,
    });
    setLoading(false);
    if (authError) {
      setError('No hemos podido enviar el correo. Revisa la dirección.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-2xl bg-sage px-4 py-3 text-[13px] leading-relaxed text-seed-800">
        Si ese correo tiene cuenta en Semilla, ya tiene un enlace esperando. Ábrelo desde este móvil.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Correo">
        <TextInput
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@correo.com"
        />
      </Field>
      {error ? <p className="text-[13px] font-medium text-coral-deep">{error}</p> : null}
      <Button type="submit" full disabled={loading}>
        {loading ? 'Enviando…' : 'Enviar enlace'}
      </Button>
    </form>
  );
}
