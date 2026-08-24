'use client';

import Link from 'next/link';
import { AlertTriangle, Download, ShieldCheck, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button, Card, Field, SectionTitle, TextInput } from '@/components/ui/primitives';
import { backupFileName, buildBackup, canRestore, readBackup, rehomeBackup } from '@/domain/backup';
import { formatDayLong, nowISO } from '@/domain/dates';
import type { HouseholdData } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * AJUSTES (§110, §111, §112) — vuestro hogar y vuestros datos.
 *
 * Aquí no hay analítica, ni cuentas de terceros, ni nada que enviar a ningún
 * sitio. Lo único que sale de la app es el archivo de copia, y sale al móvil de
 * quien lo pide.
 */
export function SettingsScreen() {
  const { data, actions, currentUserId } = useSemilla();

  const [name, setName] = useState(data.household.name);
  const [savingName, setSavingName] = useState(false);
  const [restore, setRestore] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const me = data.members.find((member) => member.userId === currentUserId) ?? null;
  const [myName, setMyName] = useState(me?.name ?? '');

  async function exportBackup() {
    const now = nowISO();
    const backup = buildBackup(data, now);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName(data, now);
    link.click();
    URL.revokeObjectURL(url);
    await actions.markBackup();
  }

  async function importBackup(file: File) {
    setRestore(null);
    const read = readBackup(await file.text());
    if (!read.ok) {
      setRestore({ tone: 'bad', text: read.reason });
      return;
    }

    const allowed = canRestore(data);
    if (!allowed.allowed) {
      setRestore({ tone: 'bad', text: allowed.reason });
      return;
    }

    const restored = rehomeBackup(read.backup, data.household.id);
    const steps = buildRestoreSteps(restored);
    setProgress({ done: 0, total: steps.length });

    try {
      let done = 0;
      for (const step of steps) {
        await step();
        done += 1;
        setProgress({ done, total: steps.length });
      }
      setRestore({
        tone: 'good',
        text: `Restaurado: ${read.summary.transactions} movimientos de ${read.summary.householdName}.`,
      });
    } catch (error) {
      setRestore({
        tone: 'bad',
        text:
          error instanceof Error
            ? `Se ha parado a mitad: ${error.message}`
            : 'Se ha parado a mitad de la restauración.',
      });
    } finally {
      setProgress(null);
    }
  }

  /** Orden importante: nada puede apuntar a algo que todavía no existe. */
  function buildRestoreSteps(source: HouseholdData): (() => Promise<void>)[] {
    const steps: (() => Promise<void>)[] = [];
    for (const account of source.accounts) steps.push(() => actions.saveAccount(account));
    for (const method of source.paymentMethods) steps.push(() => actions.savePaymentMethod(method));
    for (const category of source.categories) {
      steps.push(() => actions.saveCategory(category));
      for (const sub of category.subcategories) steps.push(() => actions.saveSubcategory(sub));
    }
    for (const tag of source.tags) steps.push(() => actions.saveTag(tag));
    for (const item of source.incomeSources) steps.push(() => actions.saveIncomeSource(item));
    for (const pocket of source.pockets) steps.push(() => actions.savePocket(pocket));
    for (const debt of source.debts) steps.push(() => actions.saveDebt(debt));
    for (const item of source.plannedItems) steps.push(() => actions.savePlannedItem(item));
    for (const goal of source.goals) steps.push(() => actions.saveGoal(goal));
    for (const budget of source.monthlyBudgets) {
      steps.push(() => actions.saveMonthlyBudget(budget.month, budget.planned));
    }
    for (const budget of source.weeklyBudgets) {
      steps.push(() => actions.saveWeeklyBudget(budget.month, budget.weekIndex, budget.planned));
    }
    for (const transaction of source.transactions) steps.push(() => actions.addTransaction(transaction));
    for (const close of source.weeklyCloses) steps.push(() => actions.saveWeeklyClose(close));
    for (const close of source.monthlyCloses) steps.push(() => actions.saveMonthlyClose(close));
    return steps;
  }

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <Link href="/mas" className="text-[13px] font-medium text-muted">
          ‹ Más
        </Link>
        <h1 className="mt-1 text-title text-ink">Ajustes</h1>
        <p className="mt-0.5 text-[13px] text-muted">Vuestro hogar y vuestros datos.</p>
      </header>

      <section>
        <SectionTitle>El hogar</SectionTitle>
        <Card className="space-y-4">
          <Field label="Cómo se llama">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Button
            variant="secondary"
            full
            disabled={savingName || !name.trim() || name.trim() === data.household.name}
            onClick={async () => {
              setSavingName(true);
              try {
                await actions.renameHousehold(name.trim());
              } finally {
                setSavingName(false);
              }
            }}
          >
            {savingName ? 'Guardando…' : 'Guardar nombre'}
          </Button>
        </Card>
      </section>

      {me ? (
        <section className="mt-6">
          <SectionTitle>Tu nombre</SectionTitle>
          <Card className="space-y-4">
            <Field label="Como aparecéis en los movimientos">
              <TextInput value={myName} onChange={(event) => setMyName(event.target.value)} />
            </Field>
            <Button
              variant="secondary"
              full
              disabled={!myName.trim() || myName.trim() === me.name}
              onClick={() => actions.updateMemberName(me.id, myName.trim())}
            >
              Guardar
            </Button>
          </Card>
        </section>
      ) : null}

      {/* Copia de seguridad (§111) */}
      <section className="mt-6">
        <SectionTitle>Copia de seguridad</SectionTitle>
        <Card className="space-y-4">
          <p className="text-[13px] leading-relaxed text-muted">
            Un archivo con todo: movimientos, presupuestos, huchas, deuda y cierres. Se genera en este
            móvil y se guarda donde tú digas. No se envía a ningún sitio.
          </p>

          <Button full onClick={exportBackup}>
            <Download size={18} /> Descargar copia
          </Button>

          <p className="text-[12px] text-muted tnum">
            {data.settings.lastBackupAt
              ? `Última copia: ${formatDayLong(data.settings.lastBackupAt.slice(0, 10))}.`
              : 'Todavía no habéis hecho ninguna.'}
          </p>

          <div className="border-t border-stone-100 pt-4">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importBackup(file);
                event.target.value = '';
              }}
            />
            <Button
              variant="secondary"
              full
              disabled={progress !== null}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={18} />
              {progress ? `Restaurando… ${progress.done} de ${progress.total}` : 'Restaurar una copia'}
            </Button>

            <div className="mt-3 flex gap-2.5">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-deep" aria-hidden />
              <p className="text-[12px] leading-relaxed text-muted">
                Restaurar sólo funciona en un hogar sin movimientos. Mezclar dos historias distintas
                daría cifras que no son de nadie.
              </p>
            </div>

            {restore ? (
              <p
                className={`mt-3 rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                  restore.tone === 'good' ? 'bg-sage text-seed-800' : 'bg-amber-bg text-amber-deep'
                }`}
              >
                {restore.text}
              </p>
            ) : null}
          </div>
        </Card>
      </section>

      {/* Privacidad (§112) */}
      <section className="mt-6">
        <SectionTitle>Vuestros datos</SectionTitle>
        <Card>
          <div className="flex gap-3">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-seed-600" aria-hidden />
            <div className="text-[13px] leading-relaxed text-muted">
              <p>
                Todo vive en vuestra base de datos, protegido por permisos a nivel de fila: nadie que no
                pertenezca a {data.household.name} puede leerlo, ni aunque llame a la API con su propio
                usuario.
              </p>
              <p className="mt-3">
                Sin analítica, sin seguimiento, sin envío de datos a terceros. Ninguna cifra sale de aquí
                salvo en el archivo de copia que descargáis vosotros.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-muted">
        Semilla · Haz crecer lo que tienes.
      </p>
    </div>
  );
}
