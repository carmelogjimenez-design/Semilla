import type { Metadata } from 'next';

import { AccountsScreen } from '@/screens/accounts';

export const metadata: Metadata = { title: 'Cuentas' };

export default function Page() {
  return <AccountsScreen />;
}
