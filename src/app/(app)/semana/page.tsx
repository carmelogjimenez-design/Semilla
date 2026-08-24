import type { Metadata } from 'next';

import { WeekScreen } from '@/screens/week';

export const metadata: Metadata = { title: 'Semana' };

export default function Page() {
  return <WeekScreen />;
}
