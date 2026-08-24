import type { Metadata } from 'next';

import { CatalogScreen } from '@/screens/catalog';

export const metadata: Metadata = { title: 'Categorías' };

export default function Page() {
  return <CatalogScreen />;
}
