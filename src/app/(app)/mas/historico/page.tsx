import type { Metadata } from 'next';

import { HistoryScreen } from '@/screens/history';

export const metadata: Metadata = { title: 'Histórico' };

export default function Page() {
  return <HistoryScreen />;
}
