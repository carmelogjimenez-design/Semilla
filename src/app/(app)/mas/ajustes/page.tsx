import type { Metadata } from 'next';

import { SettingsScreen } from '@/screens/settings';

export const metadata: Metadata = { title: 'Ajustes' };

export default function Page() {
  return <SettingsScreen />;
}
