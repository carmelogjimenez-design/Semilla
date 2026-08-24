'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Award,
  ChevronRight,
  CreditCard,
  DatabaseBackup,
  Flame,
  History,
  LogOut,
  PiggyBank,
  Repeat,
  ShieldCheck,
  Sliders,
  Smartphone,
  Tag,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { Avatar, Button, Card, SectionTitle } from '@/components/ui/primitives';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Field, TextInput } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { useSemilla } from '@/state/semilla-provider';

/**
 * MÁS — la casa por dentro.
 * En esta fase están operativos Familia y la sesión; el resto se marca con la
 * fase en la que llega, para que nadie toque un botón que no lleva a ningún sitio.
 */

const AVAILABLE = [
  { href: '/mas/presupuestos', icon: Sliders, label: 'Presupuestos', hint: 'Mes, semanas y límites por categoría' },
  { href: '/mas/huchas', icon: PiggyBank, label: 'Huchas', hint: 'Ahorro y dinero reservado' },
  { href: '/mas/deudas', icon: Flame, label: 'Deuda', hint: 'Saldos, cuotas y amortizaciones' },
  { href: '/mas/logros', icon: Award, label: 'Logros', hint: 'Lo que ya habéis conseguido' },
  { href: '/mas/historico', icon: History, label: 'Histórico', hint: 'Cierres, comparativas y meses anteriores' },
  { href: '/mas/fijos', icon: Repeat, label: 'Comprometido', hint: 'Gastos fijos, calendario de pagos y extraordinarios' },
  { href: '/mas/categorias', icon: Tag, label: 'Categorías y etiquetas', hint: 'El vocabulario de la casa' },
  { href: '/mas/cuentas', icon: CreditCard, label: 'Cuentas', hint: 'Saldos, medios de pago' },
  { href: '/mas/ajustes', icon: DatabaseBackup, label: 'Ajustes y copia', hint: 'Nombres, copia de seguridad y privacidad' },
] as const;

const UPCOMING = [
  { icon: Smartphone, label: 'Instalar en el móvil', phase: 'Fase 8' },
] as const;

export function MoreScreen() {
  const router = useRouter();
  const { data, currentMember, actions } = useSemilla();
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentMember?.role === 'owner';
  const pendingInvites = data.invites.filter((invite) => invite.status === 'pending');

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/entrar');
    router.refresh();
  }

  async function sendInvite() {
    setBusy(true);
    setError(null);
    try {
      await actions.invite(email.trim());
      const fresh = data.invites.find((invite) => invite.email.toLowerCase() === email.trim().toLowerCase());
      setLink(fresh ? `${window.location.origin}/invitacion/${fresh.token}` : null);
      setEmail('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replace(/^.*?:\s*/, '') : 'No ha podido crearse.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <h1 className="text-title text-ink">Más</h1>
        <p className="mt-0.5 text-[13px] text-muted">{data.household.name}</p>
      </header>

      {/* Familia (§37) */}
      <section>
        <SectionTitle>Familia</SectionTitle>
        <Card className="px-4 py-3">
          <div className="divide-y divide-stone-100">
            {data.members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 py-3">
                <Avatar initials={member.initials} accent={member.accent} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">{member.name}</p>
                  <p className="text-[13px] text-muted">
                    {member.role === 'owner' ? 'Creó el hogar' : 'Miembro'}
                    {member.email ? ` · ${member.email}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {pendingInvites.length > 0 ? (
            <div className="mt-2 space-y-2 border-t border-stone-100 pt-3">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warm text-[13px]">
                    ✉️
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-ink">{invite.email}</p>
                    <p className="text-[12px] text-muted">Invitación pendiente</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(
                        `${window.location.origin}/invitacion/${invite.token}`,
                      );
                    }}
                    className="rounded-full bg-stone-100 px-3 py-1.5 text-[12px] font-semibold text-ink"
                  >
                    Copiar enlace
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {isOwner ? (
            <Button variant="secondary" full className="mt-4" onClick={() => setInviting(true)}>
              <Users size={18} /> Invitar miembro
            </Button>
          ) : null}
        </Card>
      </section>

      {/* Ya disponible */}
      <section className="mt-6">
        <SectionTitle>Vuestro plan</SectionTitle>
        <Card className="px-2 py-1">
          <div className="divide-y divide-stone-100">
            {AVAILABLE.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="block">
                  <div className="flex items-center gap-3 px-2 py-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage">
                      <Icon size={18} className="text-seed-700" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-ink">{item.label}</span>
                      <span className="block truncate text-[13px] text-muted">{item.hint}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-stone-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Roadmap visible */}
      <section className="mt-6">
        <SectionTitle>En camino</SectionTitle>
        <Card className="px-2 py-1">
          <div className="divide-y divide-stone-100">
            {UPCOMING.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 px-2 py-3.5 opacity-60">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100">
                    <Icon size={18} className="text-stone-500" aria-hidden />
                  </span>
                  <span className="flex-1 text-[15px] text-ink">{item.label}</span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-muted">
                    {item.phase}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Datos y privacidad (§111, §112) */}
      <section className="mt-6">
        <SectionTitle>Vuestros datos</SectionTitle>
        <Card>
          <div className="flex gap-3">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-seed-600" aria-hidden />
            <p className="text-[13px] leading-relaxed text-muted">
              Los datos viven en vuestra base de datos de Supabase, protegidos por permisos a nivel de fila:
              nadie que no pertenezca a {data.household.name} puede leerlos. Sin analítica externa, sin envío
              de datos a terceros.
            </p>
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <Link href="/movimientos" className="block">
          <Card className="flex items-center gap-3">
            <span className="flex-1 text-[15px] font-medium text-ink">Todos los movimientos</span>
            <ChevronRight size={18} className="text-stone-400" />
          </Card>
        </Link>
      </section>

      <button
        type="button"
        onClick={signOut}
        className="mt-6 flex w-full touch items-center justify-center gap-2 rounded-2xl bg-stone-100 py-3.5 text-[15px] font-semibold text-ink active:bg-stone-200"
      >
        <LogOut size={18} /> Cerrar sesión
      </button>

      <p className="mt-8 text-center text-[12px] text-stone-400">Semilla · Haz crecer lo que tienes.</p>

      <BottomSheet
        open={inviting}
        onClose={() => {
          setInviting(false);
          setLink(null);
        }}
        title="Invitar miembro"
        subtitle="Entrará con su propio correo y verá exactamente los mismos números."
        footer={
          link ? (
            <Button
              full
              onClick={() => {
                void navigator.clipboard?.writeText(link);
              }}
            >
              Copiar enlace
            </Button>
          ) : (
            <Button full onClick={sendInvite} disabled={busy || !email.trim()}>
              {busy ? 'Creando…' : 'Crear invitación'}
            </Button>
          )
        }
      >
        <div className="space-y-4 pb-2">
          {link ? (
            <>
              <p className="rounded-2xl bg-sage px-4 py-3 text-[13px] leading-relaxed text-seed-800">
                Invitación creada. Pásale este enlace por WhatsApp.
              </p>
              <p className="break-all rounded-2xl bg-warm px-4 py-3 text-[12px] text-ink">{link}</p>
            </>
          ) : (
            <Field label="Correo">
              <TextInput
                type="email"
                inputMode="email"
                autoCapitalize="none"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="sara@correo.com"
              />
            </Field>
          )}
          {error ? <p className="text-[13px] text-coral-deep">{error}</p> : null}
        </div>
      </BottomSheet>
    </div>
  );
}
