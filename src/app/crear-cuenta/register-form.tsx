'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button, Field, TextInput } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { siteUrl } from '@/lib/env';

export function RegisterForm({
  inviteToken,
  presetEmail,
}: {
  inviteToken: string | null;
  presetEmail: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(presetEmail ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const destination = inviteToken ? `/invitacion/${inviteToken}` : '/bienvenida';
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: `${siteUrl()}/auth/callback?siguiente=${encodeURIComponent(destination)}`,
      },
    });

    if (authError) {
      setError(
        authError.message.toLowerCase().includes('already')
          ? 'Ese correo ya tiene cuenta. Entra con él.'
          : 'No hemos podido crear la cuenta. Inténtalo otra vez.',
      );
      setLoading(false);
      return;
    }

    if (!data.session) {
      setPendingConfirmation(true);
      setLoading(false);
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  if (pendingConfirmation) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-sage px-4 py-3 text-[13px] leading-relaxed text-seed-800">
          Te hemos enviado un correo para confirmar la cuenta. Ábrelo desde este mismo móvil y volverás
          directamente a Semilla.
        </p>
        <Button variant="secondary" full onClick={() => router.push('/entrar')}>
          Ir a entrar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Tu nombre">
        <TextInput
          name="name"
          autoComplete="given-name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Carmelo"
        />
      </Field>

      <Field label="Correo">
        <TextInput
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          required
          readOnly={Boolean(presetEmail)}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@correo.com"
        />
      </Field>

      <Field label="Contraseña" hint="Mínimo 8 caracteres.">
        <TextInput
          type="password"
          name="password"
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
        {loading ? 'Creando…' : 'Crear cuenta'}
      </Button>
    </form>
  );
}
