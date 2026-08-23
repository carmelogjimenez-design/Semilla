import 'server-only';

import { createServerSupabase } from './supabase/server';

export interface SessionContext {
  userId: string;
  email: string | null;
  displayName: string;
  householdId: string | null;
  householdIds: string[];
}

/**
 * Contexto de sesión para los Server Components (§21).
 * `householdId` es el hogar activo; la arquitectura ya admite varios por usuario.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: memberships }, { data: preferences }, { data: profile }] = await Promise.all([
    supabase.from('household_members').select('household_id').eq('user_id', user.id),
    supabase.from('user_preferences').select('current_household_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('display_name, email').eq('id', user.id).maybeSingle(),
  ]);

  const householdIds = (memberships ?? []).map((row) => row.household_id);
  const preferred = preferences?.current_household_id ?? null;
  const householdId =
    preferred && householdIds.includes(preferred) ? preferred : (householdIds[0] ?? null);

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    displayName: profile?.display_name ?? user.email?.split('@')[0] ?? '',
    householdId,
    householdIds,
  };
}
