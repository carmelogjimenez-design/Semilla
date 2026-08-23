'use client';

import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { TransactionDetailSheet } from '@/components/flows/transaction-detail-sheet';
import { TransactionRow, presentTransaction } from '@/components/transaction-row';
import { Avatar, Card, Chip, EmptyState } from '@/components/ui/primitives';
import { capitalize, formatRelativeDay } from '@/domain/dates';
import { formatCurrency } from '@/domain/money';
import type { ID, Transaction, TransactionKind } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * MOVIMIENTOS responde a: ¿dónde se ha ido el dinero? (§42, §43)
 * Línea de tiempo agrupada por día, con búsqueda y filtros rápidos.
 */

const KIND_FILTERS: { value: TransactionKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'saving', label: 'Ahorro' },
  { value: 'debtPayment', label: 'Deuda' },
  { value: 'transfer', label: 'Transferencias' },
];

export function MovementsScreen() {
  const { data, today, currentMember } = useSemilla();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<TransactionKind | 'all'>('all');
  const [person, setPerson] = useState<ID | 'all'>('all');
  const [selected, setSelected] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.transactions.filter((transaction) => {
      if (kind !== 'all' && transaction.kind !== kind) return false;
      if (person !== 'all' && transaction.ownerUserId !== person) return false;
      if (!needle) return true;
      const presentation = presentTransaction(transaction, data);
      const haystack = [
        presentation.title,
        presentation.subtitle,
        transaction.note,
        transaction.description,
        String(transaction.amount / 100),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [data, query, kind, person]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const transaction of filtered) {
      const list = map.get(transaction.date) ?? [];
      list.push(transaction);
      map.set(transaction.date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const total = filtered
    .filter((t) => t.kind === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <h1 className="text-title text-ink">Movimientos</h1>
        <p className="mt-0.5 text-[13px] text-muted tnum">
          {filtered.length} {filtered.length === 1 ? 'movimiento' : 'movimientos'}
          {total > 0 ? ` · ${formatCurrency(total)} en gastos` : ''}
        </p>
      </header>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar mercadona, fisio, gasolina…"
          aria-label="Buscar movimientos"
          className="w-full rounded-2xl border border-stone-200 bg-surface py-3.5 pl-11 pr-11 text-[16px] text-ink placeholder:text-stone-400 focus:border-seed-500 focus:outline-none focus:ring-2 focus:ring-seed-500/20"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-stone-400 active:bg-stone-100"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="rail mt-3">
        {KIND_FILTERS.map((filter) => (
          <Chip key={filter.value} active={kind === filter.value} onClick={() => setKind(filter.value)}>
            {filter.label}
          </Chip>
        ))}
      </div>

      {data.members.length > 1 ? (
        <div className="rail mt-2">
          <Chip active={person === 'all'} onClick={() => setPerson('all')}>
            Todo el hogar
          </Chip>
          {data.members.map((member) => (
            <Chip key={member.id} active={person === member.userId} onClick={() => setPerson(member.userId)}>
              <Avatar initials={member.initials} accent={member.accent} size={18} />
              {member.name}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        {groups.length === 0 ? (
          <EmptyState
            emoji={query ? '🔍' : '🌱'}
            title={query ? 'Nada con esa búsqueda' : 'Aún no hay movimientos'}
            body={
              query
                ? 'Prueba con otra palabra o quita los filtros.'
                : 'Planta la primera semilla: pulsa el botón + y registra lo primero.'
            }
          />
        ) : (
          groups.map(([date, items]) => (
            <section key={date}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {capitalize(formatRelativeDay(date, today))}
                </h2>
                {(() => {
                  const spent = items
                    .filter((t) => t.kind === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0);
                  return spent > 0 ? (
                    <span className="text-[12px] text-stone-400 tnum">{formatCurrency(spent)}</span>
                  ) : null;
                })()}
              </div>
              <Card className="px-3 py-1.5">
                <div className="divide-y divide-stone-100">
                  {items.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      data={data}
                      member={data.members.find((m) => m.userId === transaction.ownerUserId) ?? null}
                      onPress={() => setSelected(transaction)}
                    />
                  ))}
                </div>
              </Card>
            </section>
          ))
        )}
      </div>

      <TransactionDetailSheet
        transaction={selected}
        onClose={() => setSelected(null)}
        currentMemberName={currentMember?.name ?? ''}
        today={today}
      />
    </div>
  );
}
