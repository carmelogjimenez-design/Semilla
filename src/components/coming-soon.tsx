import Link from 'next/link';

import { Button } from '@/components/ui/primitives';

/**
 * Pantalla honesta para lo que aún no está construido.
 * Semilla se publica por fases: preferimos decir qué falta antes que enseñar
 * una interfaz con números inventados.
 */
export function ComingSoon({
  title,
  question,
  phase,
  bullets,
}: {
  title: string;
  question: string;
  phase: string;
  bullets: string[];
}) {
  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <h1 className="text-title text-ink">{title}</h1>
        <p className="mt-0.5 text-[13px] text-muted">{question}</p>
      </header>

      <div className="rounded-3xl bg-warm px-6 py-8">
        <span className="inline-flex rounded-full bg-sage px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-seed-800">
          {phase}
        </span>
        <p className="mt-4 text-[15px] leading-relaxed text-ink">Esta pantalla llega en la siguiente entrega.</p>
        <ul className="mt-4 space-y-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2.5 text-[14px] leading-relaxed text-muted">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-seed-300" aria-hidden />
              {bullet}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[13px] leading-relaxed text-muted">
          Mientras tanto podéis registrar todo con normalidad: los movimientos que guardéis ahora alimentan
          estas pantallas cuando se publiquen.
        </p>
        <Link href="/" className="mt-6 block">
          <Button variant="secondary" full>
            Volver a inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
