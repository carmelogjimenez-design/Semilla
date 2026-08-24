import type { ReactNode } from 'react';

import { SemillaMark, SemillaWordmark } from '@/components/ui/logo';

/**
 * Armazón de las pantallas de identidad. Misma marca, mismo aire que la app (§45).
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    /* Misma columna que la app: en escritorio la identidad no se estira, se
       centra al ancho de un móvil sobre el fondo apagado. */
    <main className="flex min-h-dvh flex-col bg-warm pt-safe">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-1 flex-col bg-bg px-6 pb-10 sm:border-x sm:border-stone-200/70 sm:shadow-[0_0_80px_-30px_rgba(17,19,22,0.35)]">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <SemillaMark size={54} />
          <div>
            <SemillaWordmark className="text-[15px]" />
            <p className="mt-2 text-[13px] text-muted">Haz crecer lo que tienes.</p>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="text-title text-ink">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>

          {footer ? <div className="mt-6 text-center text-[13px] text-muted">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
