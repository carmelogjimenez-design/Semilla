'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button, Field, TextInput } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ next, notice }: { next: string; notice: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(
        authError.message.toLowerCase().includes('invalid')
          ? 'Correo o contraseña incorrectos.'
          : 'No hemos podido entrar. Inténtalo otra vez.',
      );
      setLoading(false);
      return;
    }
    router.replace(next.startsWith('/') ? next : '/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {notice ? (
        <p className="rounded-2xl bg-sage px-4 py-3 text-[13px] leading-relaxed text-seed-800">{notice}</p>
      ) : null}

      <Field label="Correo">
        <TextInput
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@correo.com"
        />
      </Field>

      <Field label="Contraseña">
        <TextInput
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
      </Field>

      {error ? <p className="text-[13px] font-medium text-coral-deep">{error}</p> : null}

      <Button type="submit" full disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </Button>

      <p className="pt-1 text-center">
        <Link href="/recuperar" className="text-[13px] text-muted underline underline-offset-4">
          He olvidado mi contraseña
        </Link>
      </p>
    </form>
  );
}
