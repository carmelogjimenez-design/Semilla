'use client';

import { CalendarRange, Home, LayoutGrid, Plus, Sprout, WalletMinimal } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddTransactionSheet } from '@/components/flows/add-transaction-sheet';
import { ComingSoon } from '@/components/coming-soon';
import { HomeScreen } from '@/screens/home';
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
  const [addOpen, setAddOpen] = useState(false);

  return (
    <SemillaProvider repository={repository} initialData={seed} currentUserId="preview-carmelo">
      <div className="mx-auto min-h-dvh w-full max-w-lg bg-bg">
        <div className="bg-amber-bg px-4 py-1.5 text-center text-[11px] font-semibold text-amber-deep">
          Previsualización de interfaz · los datos no se guardan
        </div>

        {tab === 'home' ? <HomeScreen /> : null}
        {tab === 'movements' ? <MovementsScreen /> : null}
        {tab === 'more' ? <MoreScreen /> : null}
        {tab === 'week' ? (
          <ComingSoon
            title="Semana"
            question="¿Cuánto podemos gastar?"
            phase="Fase 2 · Presupuesto"
            bullets={[
              'Presupuesto semanal propio para cada semana, incluidas las parciales',
              'Reparto por categorías con anillos y barras, sin tablas',
              'Semáforo con criterio: nunca rojo por pasarse un poco',
            ]}
          />
        ) : null}
        {tab === 'progress' ? (
          <ComingSoon
            title="Progreso"
            question="¿Está sirviendo el esfuerzo?"
            phase="Fase 4 · Progreso"
            bullets={[
              'Lo que está creciendo: ahorro, deuda reducida y margen',
              'Objetivos con fecha y proyecciones a ritmo actual',
              'Logros del hogar y rachas sin castigo',
            ]}
          />
        ) : null}

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
