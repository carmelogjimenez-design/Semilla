import type { Metadata } from 'next';

import { ProgressScreen } from '@/screens/progress';

export const metadata: Metadata = { title: 'Progreso' };

export default function Page() {
  return <ProgressScreen />;
}
