import type { Metadata } from 'next';

import { AchievementsScreen } from '@/screens/achievements';

export const metadata: Metadata = { title: 'Logros' };

export default function Page() {
  return <AchievementsScreen />;
}
