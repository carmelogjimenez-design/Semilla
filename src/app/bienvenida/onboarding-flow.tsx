'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { AmountDisplay, NumericKeypad } from '@/components/ui/amount-input';
import { Button, Field, TextInput } from '@/components/ui/primitives';
import { SemillaMark, SemillaWordmark } from '@/components/ui/logo';
import { formatCurrency } from '@/domain/money';
import { addMonths, firstDayOfMonth, monthKeyOf, systemToday } from '@/domain/dates';
import { createClient } from '@/lib/supabase/client';
import type { Cents } from '@/domain/types';

/**
 * §78 / §14 caso A — Alta de un hogar nuevo.
 * Todo se puede saltar: nada aquí bloquea el uso de la app.
 */

interface DebtDraft {
  key: string;
  name: string;
  balance: Cents;
  installment: Cents;
}

type Step = 'hello' | 'household' | 'budget' | 'debts' | 'goal' | 'invite' | 'done';

const ORDER: Step[] = ['hello', 'household', 'budget', 'debts', 'goal', 'invite', 'done'];

export function OnboardingFlow({ displayName }: { displayName: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('hello');
  const [householdName, setHouseholdName] = useState('');
  const [personName, setPersonName] = useState(displayName);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState<Cents>(0);
  const [debts, setDebts] = useState<DebtDraft[]>([]);
  const [debtName, setDebtName] = useState('');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtInstallment, setDebtInstallment] = useState('');
  const [goalName, setGoalName] = useState('Nuestro primer año');
  const [goalSavings, setGoalSavings] = useState('');
  const [goalDebt, setGoalDebt] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = systemToday();
  const month = monthKeyOf(today);

  const goNext = () => {
    const index = ORDER.indexOf(step);
    const next = ORDER[Math.min(index + 1, ORDER.length - 1)];
    if (next) setStep(next);
  };

  const parse = (value: string): Cents => {
    const digits = value.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
    const amount = Number(digits);
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  };

  async function createHousehold() {
    if (!householdName.trim()) {
      setError('Ponle un nombre a vuestro hogar.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_household', {
      p_name: householdName.trim(),
      p_display_name: personName.trim(),
    });
    setBusy(false);
    if (rpcError || !data) {
      setError('No hemos podido crear el hogar. Inténtalo otra vez.');
      return;
    }
    setHouseholdId(data);
    goNext();
  }

  async function saveBudget() {
    if (!householdId || monthlyBudget <= 0) {
      goNext();
      return;
    }
    setBusy(true);
    await supabase
      .from('monthly_budgets')
      .upsert(
        { household_id: householdId, month, planned_cents: monthlyBudget },
        { onConflict: 'household_id,month' },
      );
    setBusy(false);
    goNext();
  }

  async function saveDebts() {
    if (!householdId || debts.length === 0) {
      goNext();
      return;
    }
    setBusy(true);
    await supabase.from('debts').insert(
      debts.map((debt, index) => ({
        household_id: householdId,
        name: debt.name,
        type: 'loan' as const,
        initial_balance_cents: debt.balance,
        balance_at_start_cents: debt.balance,
        tracking_start: today,
        installment_cents: debt.installment,
        priority: index,
      })),
    );
    setBusy(false);
    goNext();
  }

  async function saveGoal() {
    const savings = parse(goalSavings);
    const debt = parse(goalDebt);
    if (!householdId || (savings === 0 && debt === 0)) {
      goNext();
      return;
    }
    setBusy(true);
    await supabase.from('goals').insert({
      household_id: householdId,
      name: goalName.trim() || 'Nuestro objetivo',
      start_date: firstDayOfMonth(month),
      end_date: firstDayOfMonth(addMonths(month, 12)),
      savings_target_cents: savings,
      extra_debt_target_cents: debt,
      green_weeks_target: 40,
    });
    setBusy(false);
    goNext();
  }

  async function sendInvite() {
    if (!householdId || !inviteEmail.trim()) {
      goNext();
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_invite', {
      p_household_id: householdId,
      p_email: inviteEmail.trim(),
    });
    setBusy(false);
    if (rpcError || !data) {
      setError('No hemos podido crear la invitación. Puedes hacerlo luego desde Más → Familia.');
      return;
    }
    setInviteLink(`${window.location.origin}/invitacion/${data.token}`);
  }

  async function finish() {
    if (householdId) {
      await supabase
        .from('app_settings')
        .upsert({ household_id: householdId, onboarded: true }, { onConflict: 'household_id' });
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-6 pb-10 pt-safe">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="flex items-center justify-between py-5">
          <SemillaMark size={26} />
          {step !== 'hello' && step !== 'done' ? (
            <button
              type="button"
              onClick={goNext}
              className="text-[13px] font-medium text-muted underline underline-offset-4"
            >
              Saltar
            </button>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-1 flex-col"
          >
            {step === 'hello' ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <SemillaMark size={76} />
                <div className="mt-6">
                  <SemillaWordmark className="text-[17px]" />
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-muted">
                  Haz crecer lo que tienes.
                  <br />
                  Cada decisión cuenta.
                </p>
                <Button className="mt-10 w-full" onClick={goNext}>
                  Empezar <ArrowRight size={18} />
                </Button>
              </div>
            ) : null}

            {step === 'household' ? (
              <div className="flex flex-1 flex-col">
                <h1 className="text-display text-ink">Vuestro hogar</h1>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Semilla no es una app individual: es una economía compartida con nombre propio.
                </p>
                <div className="mt-8 space-y-4">
                  <Field label="Nombre del hogar">
                    <TextInput
                      value={householdName}
                      onChange={(event) => setHouseholdName(event.target.value)}
                      placeholder="Familia García"
                      autoFocus
                    />
                  </Field>
                  <Field label="Cómo te llamas">
                    <TextInput
                      value={personName}
                      onChange={(event) => setPersonName(event.target.value)}
                      placeholder="Carmelo"
                    />
                  </Field>
                </div>
                {error ? <p className="mt-4 text-[13px] text-coral-deep">{error}</p> : null}
                <div className="mt-auto pt-8">
                  <Button full onClick={createHousehold} disabled={busy}>
                    {busy ? 'Creando…' : 'Continuar'}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 'budget' ? (
              <div className="flex flex-1 flex-col">
                <h1 className="text-display text-ink">¿Cuánto queréis gastar al mes?</h1>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Es una referencia, no una jaula. Podréis cambiarla cuando queráis.
                </p>
                <AmountDisplay cents={monthlyBudget} />
                <NumericKeypad value={monthlyBudget} onChange={setMonthlyBudget} />
                <div className="mt-auto pt-6">
                  <Button full onClick={saveBudget} disabled={busy}>
                    Continuar
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 'debts' ? (
              <div className="flex flex-1 flex-col">
                <h1 className="text-display text-ink">¿Tenéis deudas?</h1>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Verlas escritas es el primer paso para verlas bajar.
                </p>

                <div className="mt-6 space-y-2">
                  {debts.map((debt) => (
                    <div key={debt.key} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{debt.name}</span>
                        <span className="block text-[13px] text-muted tnum">
                          {formatCurrency(debt.balance)} · cuota {formatCurrency(debt.installment)}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Quitar ${debt.name}`}
                        onClick={() => setDebts((current) => current.filter((d) => d.key !== debt.key))}
                        className="touch rounded-full p-2 text-muted active:bg-stone-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-[1fr,auto] gap-2">
                  <TextInput
                    value={debtName}
                    onChange={(event) => setDebtName(event.target.value)}
                    placeholder="ING"
                  />
                  <button
                    type="button"
                    aria-label="Añadir deuda"
                    onClick={() => {
                      if (!debtName.trim()) return;
                      setDebts((current) => [
                        ...current,
                        {
                          key: crypto.randomUUID(),
                          name: debtName.trim(),
                          balance: parse(debtBalance),
                          installment: parse(debtInstallment),
                        },
                      ]);
                      setDebtName('');
                      setDebtBalance('');
                      setDebtInstallment('');
                    }}
                    className="touch flex items-center justify-center rounded-2xl bg-forest px-4 text-white"
                  >
                    <Plus size={20} />
                  </button>
                  <TextInput
                    value={debtBalance}
                    onChange={(event) => setDebtBalance(event.target.value)}
                    inputMode="decimal"
                    placeholder="Saldo pendiente"
                  />
                  <TextInput
                    value={debtInstallment}
                    onChange={(event) => setDebtInstallment(event.target.value)}
                    inputMode="decimal"
                    placeholder="Cuota"
                    className="col-span-1"
                  />
                </div>

                <div className="mt-auto pt-8">
                  <Button full onClick={saveDebts} disabled={busy}>
                    Continuar
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 'goal' ? (
              <div className="flex flex-1 flex-col">
                <h1 className="text-display text-ink">¿Tenéis algún objetivo?</h1>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Un año por delante. Sin presión, con dirección.
                </p>
                <div className="mt-8 space-y-4">
                  <Field label="Nombre">
                    <TextInput value={goalName} onChange={(event) => setGoalName(event.target.value)} />
                  </Field>
                  <Field label="Ahorrar">
                    <TextInput
                      value={goalSavings}
                      inputMode="decimal"
                      onChange={(event) => setGoalSavings(event.target.value)}
                      placeholder="15.000"
                    />
                  </Field>
                  <Field label="Amortizar de más">
                    <TextInput
                      value={goalDebt}
                      inputMode="decimal"
                      onChange={(event) => setGoalDebt(event.target.value)}
                      placeholder="30.000"
                    />
                  </Field>
                </div>
                <div className="mt-auto pt-8">
                  <Button full onClick={saveGoal} disabled={busy}>
                    Continuar
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 'invite' ? (
              <div className="flex flex-1 flex-col">
                <h1 className="text-display text-ink">Invita a tu pareja</h1>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Entrará con su propio correo y veréis exactamente los mismos números.
                </p>

                {inviteLink ? (
                  <div className="mt-8 space-y-4">
                    <p className="rounded-2xl bg-sage px-4 py-3 text-[13px] leading-relaxed text-seed-800">
                      Invitación creada. Envíale este enlace:
                    </p>
                    <p className="break-all rounded-2xl bg-warm px-4 py-3 text-[12px] text-ink">{inviteLink}</p>
                    <Button
                      variant="secondary"
                      full
                      onClick={() => {
                        void navigator.clipboard?.writeText(inviteLink);
                      }}
                    >
                      Copiar enlace
                    </Button>
                  </div>
                ) : (
                  <div className="mt-8">
                    <Field label="Su correo">
                      <TextInput
                        type="email"
                        inputMode="email"
                        autoCapitalize="none"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="sara@correo.com"
                      />
                    </Field>
                    {error ? <p className="mt-3 text-[13px] text-coral-deep">{error}</p> : null}
                  </div>
                )}

                <div className="mt-auto space-y-2 pt-8">
                  {!inviteLink ? (
                    <Button full onClick={sendInvite} disabled={busy}>
                      {busy ? 'Creando…' : 'Crear invitación'}
                    </Button>
                  ) : null}
                  <Button variant="ghost" full onClick={goNext}>
                    {inviteLink ? 'Continuar' : 'Ahora no'}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 'done' ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sage">
                  <Check size={34} className="text-seed-700" />
                </div>
                <h1 className="mt-6 text-display text-ink">Ya está.</h1>
                <p className="mt-2 text-[15px] text-muted">Empezamos.</p>
                <Button className="mt-10 w-full" onClick={finish}>
                  Entrar en Semilla
                </Button>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
