import { notFound } from 'next/navigation';

import { isPreviewEnabled } from '@/lib/env';
import { PreviewApp } from './preview-app';

export const metadata = { title: 'Previsualización' };

/**
 * Banco de pruebas de interfaz. Requiere NEXT_PUBLIC_SEMILLA_PREVIEW=1.
 * No toca Supabase ni guarda nada: sirve para revisar diseño sin backend.
 */
export default function PreviewPage() {
  if (!isPreviewEnabled()) notFound();
  return <PreviewApp />;
}
