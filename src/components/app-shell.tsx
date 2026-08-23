'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { CalendarRange, CloudOff, Home, LayoutGrid, Plus, Sprout, WalletMinimal } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { AddTransactionSheet } from '@/components/flows/add-transaction-sheet';
import { useSemilla } from '@/state/semilla-provider';

const TABS = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/semana', label: 'Semana', icon: CalendarRange },
  { href: '/movimientos', label: 'Movimientos', icon: WalletMinimal },
  { href: '/progreso', label: 'Progreso', icon: Sprout },
  { href: '/mas', label: 'Más', icon: LayoutGrid },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { online, syncing } = useSemilla();
  const [addOpen, setAddOpen] = useState(false);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-bg lg:max-w-5xl">
      {!online ? (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-bg px-4 py-2 text-[12px] font-semibold text-amber-deep">
          <CloudOff size={14} aria-hidden />
          Sin conexión. Lo que registres ahora no se guardará hasta que vuelva.
        </div>
      ) : null}

      {children}

      {/* Botón principal (§9) — siempre al alcance del pulgar */}
      <motion.button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Añadir movimiento"
        whileTap={{ scale: 0.92 }}
        className="fixed right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-forest text-white shadow-fab"
        style={{ bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + 14px)' }}
      >
        <Plus size={28} strokeWidth={2.4} />
        {syncing ? (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-leaf" aria-hidden />
        ) : null}
      </motion.button>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg border-t border-stone-200/60 bg-surface/95 backdrop-blur lg:max-w-5xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegación principal"
      >
        <ul className="flex h-[68px] items-stretch">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className="flex h-full flex-col items-center justify-center gap-1 pt-1"
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.4 : 1.8}
                    className={active ? 'text-forest' : 'text-stone-400'}
                    aria-hidden
                  />
                  <span
                    className={`text-[10px] font-semibold tracking-wide ${
                      active ? 'text-forest' : 'text-stone-400'
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
