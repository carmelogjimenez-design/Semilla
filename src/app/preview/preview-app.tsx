'use client';

import { CalendarRange, Home, LayoutGrid, Plus, Sprout, WalletMinimal } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddTransactionSheet } from '@/components/flows/add-transaction-sheet';
import { BudgetsScreen } from '@/screens/budgets';
import { AchievementsScreen } from '@/screens/achievements';
import { DebtsScreen } from '@/screens/debts';
import { ProgressScreen } from '@/screens/progress';
import { PocketsScreen } from '@/screens/pockets';
import { HomeScreen } from '@/screens/home';
import { WeekScreen } from '@/screens/week';
import { MovementsScreen } from '@/screens/movements';
import { MoreScreen } from '@/screens/more';
import { MemoryRepository } from '@/preview/memory-repository';
import { buildPreviewData } from '@/preview/fixtures';
import { SemillaProvider } from '@/state/semilla-provider';

const TABS = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'week', label: 'Semana', icon: CalendarRange },
  { id: 'movements', label: 'Movimientos', icon: WalletMinimal },
  { id: 'progress', label: 'Progreso', icon: Sprout },
  { id: 'more', label: 'Más', icon: LayoutGrid },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function PreviewApp() {
  const seed = useMemo(() => buildPreviewData(), []);
  const repository = useMemo(() => new MemoryRepository(seed), [seed]);
  const [tab, setTab] = useState<TabId>('home');
  const [extra, setExtra] = useState<'budgets' | 'pockets' | 'debts' | 'awards' | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <SemillaProvider repository={repository} initialData={seed} currentUserId="preview-carmelo">
      <div className="mx-auto min-h-dvh w-full max-w-lg bg-bg">
        <div className="flex items-center justify-center gap-3 bg-amber-bg px-4 py-1.5 text-[11px] font-semibold text-amber-deep">
          <span>Previsualización · los datos no se guardan</span>
          {(
            [
              ['budgets', 'Presup.'],
              ['pockets', 'Huchas'],
              ['debts', 'Deuda'],
              ['awards', 'Logros'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setExtra(extra === id ? null : id)}
              className={`rounded-full px-2 py-0.5 ${extra === id ? 'bg-amber-deep text-amber-bg' : 'bg-amber-deep/10'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {extra === 'budgets' ? <BudgetsScreen /> : null}
        {extra === 'pockets' ? <PocketsScreen /> : null}
        {extra === 'debts' ? <DebtsScreen /> : null}
        {extra === 'awards' ? <AchievementsScreen /> : null}
        {!extra && tab === 'home' ? <HomeScreen /> : null}
        {!extra && tab === 'movements' ? <MovementsScreen /> : null}
        {!extra && tab === 'more' ? <MoreScreen /> : null}
        {!extra && tab === 'week' ? <WeekScreen /> : null}
        {!extra && tab === 'progress' ? <ProgressScreen /> : null}

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Añadir movimiento"
          className="fixed right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-forest text-white shadow-fab"
          style={{ bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + 14px)' }}
        >
          <Plus size={28} strokeWidth={2.4} />
        </button>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg border-t border-stone-200/60 bg-surface/95 backdrop-blur"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <ul className="flex h-[68px] items-stretch">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <li key={item.id} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setTab(item.id)}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 pt-1"
                  >
                    <Icon
                      size={22}
                      strokeWidth={active ? 2.4 : 1.8}
                      className={active ? 'text-forest' : 'text-stone-400'}
                    />
                    <span
                      className={`text-[10px] font-semibold tracking-wide ${
                        active ? 'text-forest' : 'text-stone-400'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} />
      </div>
    </SemillaProvider>
  );
}
