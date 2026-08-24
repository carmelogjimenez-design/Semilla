import type { Metadata } from 'next';

import { BudgetsScreen } from '@/screens/budgets';

export const metadata: Metadata = { title: 'Presupuestos' };

export default function Page() {
  return <BudgetsScreen />;
}
