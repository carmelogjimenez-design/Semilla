import type { Metadata } from 'next';

import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Semana' };

export default function Page() {
  return (
    <ComingSoon
      title="Semana"
      question="¿Cuánto podemos gastar?"
      phase="Fase 2 · Presupuesto"
      bullets={[
        'Presupuesto semanal propio para cada semana, incluidas las parciales',
        'Reparto por categorías con anillos y barras, sin tablas',
        'Semáforo con criterio: nunca rojo por pasarse un poco',
        'Ritmo diario disponible y prioridades protegidas',
      ]}
    />
  );
}
