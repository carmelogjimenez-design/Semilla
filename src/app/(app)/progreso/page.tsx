import type { Metadata } from 'next';

import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Progreso' };

export default function Page() {
  return (
    <ComingSoon
      title="Progreso"
      question="¿Está sirviendo el esfuerzo?"
      phase="Fase 4 · Progreso"
      bullets={[
        'Lo que está creciendo: ahorro, deuda reducida y margen generado',
        'Objetivos con fecha y proyecciones a ritmo actual',
        'Logros del hogar y rachas sin castigo',
        'Evolución de patrimonio mes a mes',
      ]}
    />
  );
}
