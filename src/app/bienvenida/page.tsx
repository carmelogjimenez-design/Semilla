import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/session';
import { OnboardingFlow } from './onboarding-flow';

export const metadata: Metadata = { title: 'Bienvenida' };

export default async function WelcomePage() {
  const session = await getSessionContext();
  if (!session) redirect('/entrar');
  if (session.householdId) redirect('/');

  return <OnboardingFlow displayName={session.displayName} />;
}
