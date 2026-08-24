'use client';

import Link from 'next/link';
import { ChevronRight, CreditCard, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AccountSheet, PaymentMethodSheet } from '@/components/flows/account-sheets';
import { Button, Card, EmptyState, SectionTitle } from '@/components/ui/primitives';
import { formatDayLong } from '@/domain/dates';
import { formatCurrency } from '@/domain/money';
import { accountBalances } from '@/domain/selectors';
import type { Account, PaymentMethod } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * CUENTAS Y MEDIOS DE PAGO (§28).
 *
 * El saldo que se ve aquí no es el del banco: es el de partida más todo lo
 * registrado desde su fecha. Si no cuadra con el banco, casi siempre es que falta
 * registrar algo, y decirlo así evita media hora de desconfianza.
 */
export function AccountsScreen() {
  const { data, today } = useSemilla();
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [creatingMethod, setCreatingMethod] = useState(false);

  const balances = useMemo(
    () => accountBalances(data.accounts, data.transactions, today),
    [data.accounts, data.transactions, today],
  );

  const active = balances.filter((entry) => !entry.account.archived);
  const methods = data.paymentMethods.filter((method) => !method.archived);
  const total = active
    .filter((entry) => entry.account.countsAsAvailable)
    .reduce((sum, entry) => sum + entry.balance, 0);

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <Link href="/mas" className="text-[13px] font-medium text-muted">
          ‹ Más
        </Link>
        <h1 className="mt-1 text-title text-ink">Cuentas</h1>
        <p className="mt-0.5 text-[13px] text-muted">Dónde está el dinero.</p>
      </header>

      {active.length === 0 ? (
        <EmptyState
          emoji="🏦"
          title="Sin cuentas todavía"
          body="Con una basta para empezar: la del día a día."
          action={<Button onClick={() => setCreating(true)}>Añadir una cuenta</Button>}
        />
      ) : (
        <>
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Saldo disponible
            </p>
            <p className="mt-1 text-display tnum text-ink">{formatCurrency(total)}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-stone-400">
              Suma de las cuentas marcadas como disponibles. Sale del saldo de partida más todo lo
              registrado desde su fecha.
            </p>
          </Card>

          <section className="mt-6">
            <SectionTitle>Vuestras cuentas</SectionTitle>
            <Card className="px-2 py-1">
              <div className="divide-y divide-stone-100">
                {active.map((entry) => (
                  <button
                    key={entry.account.id}
                    type="button"
                    onClick={() => setEditing(entry.account)}
                    className="flex w-full items-center gap-3 px-2 py-3.5 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">
                        {entry.account.name}
                      </span>
                      <span className="block truncate text-[12px] text-muted tnum">
                        Desde el {formatDayLong(entry.account.balanceDate)}
                        {entry.account.countsAsAvailable ? '' : ' · fuera del disponible'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[15px] font-semibold tnum text-ink">
                      {formatCurrency(entry.balance)}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden />
                  </button>
                ))}
              </div>
            </Card>

            <Button variant="secondary" full className="mt-3" onClick={() => setCreating(true)}>
              <Plus size={18} /> Añadir una cuenta
            </Button>
          </section>
        </>
      )}

      <section className="mt-6">
        <SectionTitle>Medios de pago</SectionTitle>
        {methods.length === 0 ? (
          <EmptyState
            emoji="💳"
            title="Sin medios de pago"
            body="Sirven para saber de qué cuenta sale cada gasto."
            action={<Button onClick={() => setCreatingMethod(true)}>Añadir uno</Button>}
          />
        ) : (
          <>
            <Card className="px-2 py-1">
              <div className="divide-y divide-stone-100">
                {methods.map((method) => {
                  const account = data.accounts.find((entry) => entry.id === method.accountId);
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setEditingMethod(method)}
                      className="flex w-full items-center gap-3 px-2 py-3 text-left"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warm">
                        <CreditCard size={16} className="text-muted" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-ink">{method.name}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {account ? `Sale de ${account.name}` : 'Sin cuenta asociada'}
                        </span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </Card>

            <Button variant="secondary" full className="mt-3" onClick={() => setCreatingMethod(true)}>
              <Plus size={18} /> Añadir medio de pago
            </Button>
          </>
        )}
      </section>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-stone-400">
        Si un saldo no cuadra con el del banco,
        <br />
        casi siempre es que falta registrar algo.
      </p>

      <AccountSheet open={creating} onClose={() => setCreating(false)} account={null} />
      <AccountSheet open={editing !== null} onClose={() => setEditing(null)} account={editing} />
      <PaymentMethodSheet
        open={creatingMethod}
        onClose={() => setCreatingMethod(false)}
        method={null}
      />
      <PaymentMethodSheet
        open={editingMethod !== null}
        onClose={() => setEditingMethod(null)}
        method={editingMethod}
      />
    </div>
  );
}
