import type { Metadata } from 'next';

import { MovementsScreen } from '@/screens/movements';

export const metadata: Metadata = { title: 'Movimientos' };

export default function Page() {
  return <MovementsScreen />;
}
