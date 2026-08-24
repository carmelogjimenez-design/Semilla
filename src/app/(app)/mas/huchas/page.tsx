import type { Metadata } from 'next';

import { PocketsScreen } from '@/screens/pockets';

export const metadata: Metadata = { title: 'Huchas' };

export default function Page() {
  return <PocketsScreen />;
}
