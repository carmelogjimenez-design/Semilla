import type { Metadata } from 'next';

import { DebtsScreen } from '@/screens/debts';

export const metadata: Metadata = { title: 'Deuda' };

export default function Page() {
  return <DebtsScreen />;
}
