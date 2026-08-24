import type { Metadata } from 'next';

import { InstallScreen } from '@/screens/install';

export const metadata: Metadata = { title: 'Instalar' };

export default function Page() {
  return <InstallScreen />;
}
