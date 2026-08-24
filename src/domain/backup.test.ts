import { describe, expect, it } from 'vitest';

import { backupFileName, buildBackup, canRestore, readBackup, rehomeBackup } from './backup';
import type { HouseholdData, Transaction } from './types';

const stamp = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const H = 'casa-vieja';

const movimiento: Transaction = {
  id: 't1',
  householdId: H,
  kind: 'expense',
  amount: 5_000,
  date: '2026-03-02',
  description: 'Mercadona',
  note: '',
  accountId: 'acc',
  paymentMethodId: null,
  ownerUserId: 'u1',
  createdByUserId: 'u1',
  updatedByUserId: null,
  plannedId: null,
  tagIds: [],
  categoryId: 'cat',
  subcategoryId: null,
  merchantId: null,
  necessity: 'necessary',
  frequency: 'ordinary',
  expectedAmount: null,
  ...stamp,
};

function household(transactions: Transaction[]): HouseholdData {
  return {
    household: {
      id: H,
      name: 'Familia García',
      createdBy: 'u1',
      locale: 'es-ES',
      currency: 'EUR',
      timeZone: 'Europe/Madrid',
      createdAt: stamp.createdAt,
    },
    settings: { householdId: H, onboarded: true, demoDataLoaded: false, lastBackupAt: null },
    members: [],
    accounts: [],
    paymentMethods: [],
    categories: [],
    tags: [],
    merchants: [],
    incomeSources: [],
    transactions,
    monthlyBudgets: [],
    weeklyBudgets: [],
    plannedItems: [],
    pockets: [],
    debts: [],
    goals: [],
    achievements: [],
    weeklyCloses: [],
    monthlyCloses: [],
    quickActions: [],
    invites: [
      {
        id: 'i1',
        householdId: H,
        email: 'sara@correo.com',
        role: 'member',
        token: 'secreto',
        status: 'pending',
        createdAt: stamp.createdAt,
        expiresAt: stamp.createdAt,
      },
    ],
  };
}

/* ------------------------------------------------------------------------ */

describe('copia de seguridad (§111)', () => {
  it('no mete los tokens de invitación en un archivo que se guarda para siempre', () => {
    const backup = buildBackup(household([movimiento]), '2026-08-24T10:00:00Z');
    expect(backup.data.invites).toEqual([]);
    expect(JSON.stringify(backup)).not.toContain('secreto');
  });

  it('el nombre del archivo lleva la fecha y no lleva acentos', () => {
    expect(backupFileName(household([]), '2026-08-24T10:00:00Z')).toBe(
      'semilla-familia-garcia-2026-08-24.json',
    );
  });

  it('lo exportado se puede volver a leer', () => {
    const backup = buildBackup(household([movimiento]), '2026-08-24T10:00:00Z');
    const read = readBackup(JSON.stringify(backup));

    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.summary.transactions).toBe(1);
    expect(read.summary.householdName).toBe('Familia García');
  });
});

describe('leer un archivo cualquiera', () => {
  it('rechaza lo que no es JSON', () => {
    const read = readBackup('esto no es json');
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toContain('JSON');
  });

  it('rechaza un JSON que no es de Semilla', () => {
    const read = readBackup('{"hola":"mundo"}');
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toContain('no es una copia de Semilla');
  });

  it('rechaza una copia de una versión futura en vez de destrozarla', () => {
    const read = readBackup(
      JSON.stringify({ format: 'semilla.backup', version: 99, data: { transactions: [] } }),
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toContain('más nueva');
  });
});

describe('restaurar', () => {
  it('no deja restaurar encima de un hogar con movimientos', () => {
    expect(canRestore(household([movimiento])).allowed).toBe(false);
  });

  it('deja restaurar en un hogar vacío', () => {
    expect(canRestore(household([])).allowed).toBe(true);
  });

  it('reasigna todo al hogar actual, conservando los identificadores', () => {
    const backup = buildBackup(household([movimiento]), '2026-08-24T10:00:00Z');
    const restored = rehomeBackup(backup, 'casa-nueva');

    expect(restored.household.id).toBe('casa-nueva');
    expect(restored.transactions[0]?.householdId).toBe('casa-nueva');
    expect(restored.transactions[0]?.id).toBe('t1');
  });
});
