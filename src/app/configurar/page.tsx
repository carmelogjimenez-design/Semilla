import type { Metadata } from 'next';

import { SemillaMark, SemillaWordmark } from '@/components/ui/logo';
import { isSupabaseConfigured } from '@/lib/env';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Configuración pendiente' };

/**
 * Pantalla de cortesía cuando faltan las variables de entorno.
 * Evita el clásico error en blanco en el primer despliegue.
 */
export default function ConfigurePage() {
  if (isSupabaseConfigured()) redirect('/');

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <SemillaMark size={48} />
        <SemillaWordmark className="text-[14px]" />
      </div>

      <div className="card p-6">
        <h1 className="text-title text-ink">Falta conectar Supabase</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Semilla necesita dos variables de entorno para hablar con vuestra base de datos.
        </p>

        <pre className="mt-5 overflow-x-auto rounded-2xl bg-warm p-4 text-[12px] leading-relaxed text-ink">
          {`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...`}
        </pre>

        <ol className="mt-5 space-y-3 text-[14px] leading-relaxed text-ink">
          <li>
            <span className="font-semibold">1.</span> En local: copia <code>.env.example</code> a{' '}
            <code>.env.local</code> y pega los valores del panel de Supabase.
          </li>
          <li>
            <span className="font-semibold">2.</span> En Vercel: Project Settings → Environment Variables, para
            Production, Preview y Development.
          </li>
          <li>
            <span className="font-semibold">3.</span> Aplica las migraciones con{' '}
            <code>supabase db push</code> y vuelve a desplegar.
          </li>
        </ol>

        <p className="mt-5 text-[13px] text-muted">
          El README del repositorio tiene el paso a paso completo, incluidas las URLs de redirección de Auth.
        </p>
      </div>
    </main>
  );
}
