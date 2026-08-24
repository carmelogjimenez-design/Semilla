import type { HouseholdData, ISODateTime } from './types';

/**
 * COPIA DE SEGURIDAD (§111, §112).
 *
 * Los datos son del hogar, no de la app: tiene que poder sacarlos en cualquier
 * momento, leerlos sin Semilla delante y volver a meterlos si un día hace falta.
 * El formato es JSON plano y legible, sin comprimir y sin cifrar: si hiciera
 * falta un programa especial para abrirlo, no sería una copia de seguridad.
 *
 * No se envía a ningún sitio. El archivo se genera en el móvil y se queda donde
 * la persona lo guarde.
 */

export const BACKUP_FORMAT = 'semilla.backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: ISODateTime;
  householdName: string;
  data: HouseholdData;
}

export function buildBackup(data: HouseholdData, now: ISODateTime): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    householdName: data.household.name,
    /* Las invitaciones llevan tokens de un solo uso: no tiene sentido guardarlas
       en un archivo que se queda en el móvil durante años. */
    data: { ...data, invites: [] },
  };
}

/** Nombre de archivo con fecha, para que dos copias no se pisen. */
export function backupFileName(data: HouseholdData, now: ISODateTime): string {
  const slug = data.household.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `semilla-${slug || 'hogar'}-${now.slice(0, 10)}.json`;
}

/* ------------------------------------------------------------------ *
 * Lectura de una copia
 * ------------------------------------------------------------------ */

export interface BackupSummary {
  householdName: string;
  exportedAt: ISODateTime;
  transactions: number;
  categories: number;
  accounts: number;
  pockets: number;
  debts: number;
  plannedItems: number;
}

export type BackupRead =
  | { ok: true; backup: Backup; summary: BackupSummary }
  | { ok: false; reason: string };

/**
 * Lee un archivo de copia. Nunca lanza: devuelve el motivo en castellano para
 * poder enseñarlo tal cual. Un archivo que no es de Semilla se rechaza antes de
 * tocar nada, no a mitad de la restauración.
 */
export function readBackup(raw: string): BackupRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'El archivo no es un JSON válido.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'El archivo está vacío o no tiene el formato esperado.' };
  }

  const candidate = parsed as Partial<Backup>;
  if (candidate.format !== BACKUP_FORMAT) {
    return { ok: false, reason: 'Este archivo no es una copia de Semilla.' };
  }
  if (typeof candidate.version !== 'number' || candidate.version > BACKUP_VERSION) {
    return {
      ok: false,
      reason: 'La copia viene de una versión más nueva de Semilla. Actualiza la app antes de restaurarla.',
    };
  }

  const data = candidate.data;
  if (!data || typeof data !== 'object' || !Array.isArray(data.transactions)) {
    return { ok: false, reason: 'La copia está incompleta: le faltan los movimientos.' };
  }

  return {
    ok: true,
    backup: candidate as Backup,
    summary: {
      householdName: candidate.householdName ?? data.household?.name ?? 'Hogar',
      exportedAt: candidate.exportedAt ?? '',
      transactions: data.transactions.length,
      categories: data.categories?.length ?? 0,
      accounts: data.accounts?.length ?? 0,
      pockets: data.pockets?.length ?? 0,
      debts: data.debts?.length ?? 0,
      plannedItems: data.plannedItems?.length ?? 0,
    },
  };
}

/**
 * Restaurar es una operación destructiva disfrazada de inocente: si el hogar ya
 * tiene movimientos, mezclar dos historias distintas produce cifras que no son de
 * nadie. Por eso sólo se permite sobre un hogar vacío, que es el caso real de una
 * copia de seguridad: empezar de nuevo.
 */
export function canRestore(current: HouseholdData): { allowed: boolean; reason: string } {
  if (current.transactions.length > 0) {
    return {
      allowed: false,
      reason:
        'Este hogar ya tiene movimientos registrados. Restaurar encima mezclaría dos historias y las cifras dejarían de ser ciertas.',
    };
  }
  return { allowed: true, reason: '' };
}

/**
 * Adapta el contenido de la copia al hogar actual: los identificadores internos
 * se conservan, pero el hogar es el de ahora. Sin esto, la base de datos
 * rechazaría cada fila por las políticas de seguridad, y con razón.
 */
export function rehomeBackup(backup: Backup, householdId: string): HouseholdData {
  const stamp = <T extends { householdId: string }>(items: readonly T[]): T[] =>
    items.map((item) => ({ ...item, householdId }));

  const data = backup.data;
  return {
    ...data,
    household: { ...data.household, id: householdId },
    settings: { ...data.settings, householdId },
    accounts: stamp(data.accounts),
    paymentMethods: stamp(data.paymentMethods),
    categories: stamp(data.categories).map((category) => ({
      ...category,
      subcategories: category.subcategories.map((sub) => ({ ...sub, householdId })),
    })),
    tags: stamp(data.tags),
    merchants: stamp(data.merchants),
    incomeSources: stamp(data.incomeSources),
    transactions: stamp(data.transactions),
    monthlyBudgets: stamp(data.monthlyBudgets),
    weeklyBudgets: stamp(data.weeklyBudgets),
    plannedItems: stamp(data.plannedItems),
    pockets: stamp(data.pockets),
    debts: stamp(data.debts),
    goals: stamp(data.goals),
    weeklyCloses: stamp(data.weeklyCloses),
    monthlyCloses: stamp(data.monthlyCloses),
    quickActions: stamp(data.quickActions),
    invites: [],
  };
}
