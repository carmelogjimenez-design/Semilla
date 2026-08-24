import type { Metadata } from 'next';

import { CommittedScreen } from '@/screens/committed';

export const metadata: Metadata = { title: 'Comprometido' };

export default function Page() {
  return <CommittedScreen />;
}
