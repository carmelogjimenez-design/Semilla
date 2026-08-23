import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SemillaMark, SemillaWordmark } from '@/components/ui/logo';
import { isSupabaseConfigured, supabaseConfigProblem, type ConfigProblem } from '@/lib/env';

export const metadata: Metadata = { title: 'Configuración pendiente' };
export const dynamic = 'force-dynamic';

const DIAGNOSIS: Record<Exclude<ConfigProblem, null>, { title: string; detail: string }> = {
  'missing-url': {
    title: 'Falta NEXT_PUBLIC_SUPABASE_URL',
    detail: 'La variable no llega al despliegue. Añádela y vuelve a desplegar.',
  },
  'missing-key': {
    title: 'Falta NEXT_PUBLIC_SUPABASE_ANON_KEY',
    detail: 'La variable no llega al despliegue. Añádela y vuelve a desplegar.',
  },
  'placeholder-url': {
    title: 'La URL no es la vuestra todavía',
    detail: 'Sigue puesto el valor de ejemplo, o se pegó la línea entera del .env en lugar de sólo el valor.',
  },
  'placeholder-key': {
    title: 'La clave no es la vuestra todavía',
    detail: 'Sigue puesto el valor de ejemplo, o se pegó la línea entera del .env en lugar de sólo el valor.',
  },
  'invalid-url': {
    title: 'La URL de Supabase no es válida',
    detail:
      'Debe ser exactamente https://xxxx.supabase.co, sin barra final, sin comillas y sin el nombre de la variable delante.',
  },
};

/**
 * Pantalla de cortesía cuando la configuración no sirve.
 * Dice qué falla en concreto, en vez de dejar un error en blanco.
 */
export default function ConfigurePage() {
  if (isSupabaseConfigured()) redirect('/');
  const problem = supabaseConfigProblem();
  const diagnosis = problem ? DIAGNOSIS[problem] : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <SemillaMark size={48} />
        <SemillaWordmark className="text-[14px]" />
      </div>

      <div className="card p-6">
        <h1 className="text-title text-ink">Falta conectar Supabase</h1>

        {diagnosis ? (
          <div className="mt-4 rounded-2xl bg-amber-bg p-4">
            <p className="text-[14px] font-semibold text-amber-deep">{diagnosis.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-deep/85">{diagnosis.detail}</p>
          </div>
        ) : null}

        <p className="mt-4 text-[14px] leading-relaxed text-muted">
          Semilla necesita estas dos variables para hablar con vuestra base de datos:
        </p>

        <pre className="mt-4 overflow-x-auto rounded-2xl bg-warm p-4 text-[12px] leading-relaxed text-ink">
          {`NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...`}
        </pre>

        <ol className="mt-5 space-y-3 text-[14px] leading-relaxed text-ink">
          <li>
            <span className="font-semibold">1.</span> En Supabase, botón <strong>Connect</strong> → App Frameworks
            → Next.js. Ahí están los dos valores.
          </li>
          <li>
            <span className="font-semibold">2.</span> En Vercel: Settings → Environment Variables. En{' '}
            <strong>Value</strong> va sólo lo que hay después del <code>=</code>: ni el nombre, ni comillas, ni
            barra final.
          </li>
          <li>
            <span className="font-semibold">3.</span> Deployments → ⋯ → <strong>Redeploy</strong>, desmarcando{' '}
            <em>Use existing Build Cache</em>. Estas variables se incrustan al compilar, así que hay que
            reconstruir.
          </li>
        </ol>

        <p className="mt-5 text-[13px] text-muted">
          El README del repositorio tiene el paso a paso completo, incluidas las URLs de redirección de Auth.
        </p>
      </div>
    </main>
  );
}
