'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

import { BudgetBar } from '@/components/ui/progress';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { evaluateAchievements, type AchievementState } from '@/domain/achievements';
import { formatDayLong } from '@/domain/dates';
import { useSemilla } from '@/state/semilla-provider';

/**
 * LOGROS (§36, §37) — gamificación adulta.
 *
 * Los logros son del HOGAR, nunca de una persona: aquí no hay competición ni
 * ranking. Los que faltan muestran cuánto queda, porque saber qué falta motiva
 * más que una silueta gris.
 */
export function AchievementsScreen() {
  const { data, view } = useSemilla();

  const achievements = useMemo(
    () => evaluateAchievements(view.achievementContext, data.achievements),
    [view.achievementContext, data.achievements],
  );

  const unlocked = achievements.filter((entry) => entry.unlocked);
  const pending = achievements.filter((entry) => !entry.unlocked);

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <Link href="/progreso" className="text-[13px] font-medium text-muted">
          ‹ Progreso
        </Link>
        <h1 className="mt-1 text-title text-ink">Logros</h1>
        <p className="mt-0.5 text-[13px] text-muted tnum">
          {unlocked.length} de {achievements.length} · del hogar, no de uno
        </p>
      </header>

      {unlocked.length > 0 ? (
        <section>
          <SectionTitle>Conseguidos</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {unlocked.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.04, 0.3), type: 'spring', stiffness: 260, damping: 24 }}
                className="rounded-3xl bg-sage p-4"
              >
                <span className="text-2xl" aria-hidden>
                  {entry.emoji}
                </span>
                <p className="mt-2 text-[14px] font-semibold text-seed-900">{entry.title}</p>
                <p className="mt-1 text-[12px] leading-snug text-seed-800/80">{entry.description}</p>
                {entry.unlockedAt ? (
                  <p className="mt-2 text-[11px] text-seed-800/60">{formatDayLong(entry.unlockedAt.slice(0, 10))}</p>
                ) : null}
              </motion.div>
            ))}
          </div>
        </section>
      ) : null}

      {pending.length > 0 ? (
        <section className="mt-6">
          <SectionTitle>En camino</SectionTitle>
          <Card className="space-y-5">
            {pending.map((entry) => (
              <PendingAchievement key={entry.id} achievement={entry} />
            ))}
          </Card>
        </section>
      ) : null}

      <p className="mt-8 text-center text-[12px] leading-relaxed text-stone-400">
        Ninguno mide quién de los dos lo hizo.
        <br />
        Todos son de la casa.
      </p>
    </div>
  );
}

function PendingAchievement({ achievement }: { achievement: AchievementState }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-xl grayscale">
        <span aria-hidden>{achievement.emoji}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{achievement.title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{achievement.description}</p>
        <div className="mt-2 flex items-center gap-2">
          <BudgetBar value={achievement.progress} status="neutral" height={5} className="flex-1" />
          <span className="shrink-0 text-[11px] text-muted tnum">{achievement.detail}</span>
        </div>
      </div>
    </div>
  );
}
