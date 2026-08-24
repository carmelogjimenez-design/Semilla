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
    /* Semilla es una app de móvil. En una pantalla grande NO se estira: se
       centra a su ancho natural sobre un fondo más apagado, con los cantos
       marcados. Estirar los mismos elementos a 1.000 px es lo que hace que una
       app móvil parezca una web a medio hacer. */
    <div className="min-h-dvh bg-warm">
      <div className="mx-auto min-h-dvh w-full max-w-lg bg-bg sm:border-x sm:border-stone-200/70 sm:shadow-[0_0_80px_-30px_rgba(17,19,22,0.35)]">
        {!online ? (
          <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-bg px-4 py-2 text-[12px] font-semibold text-amber-deep">
            <CloudOff size={14} aria-hidden />
            Sin conexión. Lo que registres ahora no se guardará hasta que vuelva.
          </div>
        ) : null}

        {/* Saltar a lo importante: con lector de pantalla o con teclado, la barra
            inferior no debería obligar a pasar por delante en cada pantalla. */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-white"
        >
          Saltar al contenido
        </a>

        <main id="contenido">{children}</main>
      </div>

      {/* Capa fija anclada a la columna, no a la ventana: en escritorio el botón
          y la barra tienen que quedar sobre la app, no pegados al borde de la
          pantalla. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg">
        {/* Botón principal (§9) — siempre al alcance del pulgar */}
        <motion.button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Añadir movimiento"
          whileTap={{ scale: 0.92 }}
          className="pointer-events-auto absolute right-5 z-10 flex h-16 w-16 items-center justify-center rounded-full bg-forest text-white shadow-fab"
          style={{ bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + 14px)' }}
        >
          <Plus size={28} strokeWidth={2.4} />
          {syncing ? (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-leaf" aria-hidden />
          ) : null}
        </motion.button>

        <nav
          className="pointer-events-auto border-t border-stone-200/60 bg-surface/95 backdrop-blur sm:border-x sm:border-stone-200/70"
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
                      className={active ? 'text-forest' : 'text-muted'}
                      aria-hidden
                    />
                    <span
                      className={`text-[10px] font-semibold tracking-wide ${
                        active ? 'text-forest' : 'text-muted'
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
      </div>

      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
