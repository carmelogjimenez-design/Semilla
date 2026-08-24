'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button, Field, TextInput } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { siteUrl } from '@/lib/env';

/**
 * Traduce el fallo real de Supabase a algo que se pueda leer y, sobre todo, sobre
 * lo que se pueda actuar.
 *
 * Antes había una sola frase para todo —«no hemos podido crear la cuenta»— y eso
 * escondía justo el dato que hacía falta para arreglarlo: no es lo mismo haber
 * agotado el límite de correos que tener el registro cerrado. Cuando el error no
 * es de los conocidos se enseña tal cual, en pequeño: prefiero un mensaje feo a
 * un callejón sin salida.
 */
function explainAuthError(error: { message: string; code?: string | undefined }): string {
  const code = error.code ?? '';
  const text = error.message.toLowerCase();

  if (code === 'user_already_exists' || text.includes('already registered') || text.includes('already')) {
    return 'Ese correo ya tiene cuenta. Entra con él desde el enlace de abajo.';
  }
  if (code === 'over_email_send_rate_limit' || text.includes('rate limit')) {
    return 'Se han enviado demasiados correos seguidos. Espera un rato y vuelve a intentarlo.';
  }
  if (code === 'signup_disabled' || text.includes('signups not allowed')) {
    return 'El registro está cerrado en este momento.';
  }
  if (code === 'weak_password' || text.includes('password')) {
    return 'Esa contraseña no vale. Prueba con una más larga.';
  }
  if (code === 'email_address_invalid' || text.includes('invalid format')) {
    return 'Ese correo no tiene una forma válida.';
  }
  if (text.includes('database error')) {
    return 'La base de datos ha rechazado el alta. Avisa a quien te invitó: es un fallo de configuración, no tuyo.';
  }
  return `No hemos podido crear la cuenta. El servidor dice: ${error.message}`;
}

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
      setError(explainAuthError(authError));
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
