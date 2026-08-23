'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import type { HealthStatus, MemberAccent } from '@/domain/types';

/* --- Contenedores -------------------------------------------------------- */

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <Tag className={`card p-5 ${className ?? ''}`}>{children}</Tag>;
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-end justify-between gap-3 ${className ?? ''}`}>
      <h2 className="label">{children}</h2>
      {action}
    </div>
  );
}

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 pb-nav ${className ?? ''}`}>{children}</div>;
}

/* --- Estado -------------------------------------------------------------- */

const STATUS_STYLE: Record<HealthStatus, { chip: string; dot: string }> = {
  green: { chip: 'bg-seed-100 text-seed-800', dot: 'bg-leaf' },
  amber: { chip: 'bg-amber-bg text-amber-deep', dot: 'bg-amber-soft' },
  red: { chip: 'bg-coral-bg text-coral-deep', dot: 'bg-coral' },
  neutral: { chip: 'bg-stone-100 text-muted', dot: 'bg-stone-400' },
};

export function StatusChip({
  status,
  children,
  className,
}: {
  status: HealthStatus;
  children: ReactNode;
  className?: string;
}) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.chip} ${className ?? ''}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {children}
    </span>
  );
}

export function Chip({
  children,
  active = false,
  onClick,
  className,
  title,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  title?: string;
}) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${
        active ? 'bg-forest text-white' : 'bg-stone-100 text-ink active:bg-stone-200'
      } ${className ?? ''}`}
    >
      {children}
    </Tag>
  );
}

/* --- Botones ------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLE: Record<ButtonVariant, string> = {
  primary: 'bg-forest text-white active:bg-seed-800 disabled:bg-stone-300',
  secondary: 'bg-sage text-forest active:bg-seed-200 disabled:bg-stone-100 disabled:text-stone-400',
  ghost: 'bg-transparent text-forest active:bg-stone-100',
  danger: 'bg-coral-bg text-coral-deep active:bg-coral/20',
};

export function Button({
  children,
  variant = 'primary',
  full = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; full?: boolean }) {
  return (
    <button
      {...props}
      className={`touch inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold transition disabled:cursor-not-allowed ${
        BUTTON_STYLE[variant]
      } ${full ? 'w-full' : ''} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      className={`touch inline-flex items-center justify-center rounded-full bg-stone-100 p-2.5 text-ink transition active:bg-stone-200 ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

/* --- Filas y listas ------------------------------------------------------ */

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  valueHint,
  onClick,
  chevron = false,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  valueHint?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
}) {
  const content = (
    <>
      {icon ? <span className="flex h-10 w-10 shrink-0 items-center justify-center">{icon}</span> : null}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] font-medium text-ink">{title}</span>
        {subtitle ? <span className="mt-0.5 block truncate text-[13px] text-muted">{subtitle}</span> : null}
      </span>
      {value !== undefined ? (
        <span className="shrink-0 text-right">
          <span className="block text-[15px] font-semibold tnum text-ink">{value}</span>
          {valueHint ? <span className="mt-0.5 block text-[12px] text-muted tnum">{valueHint}</span> : null}
        </span>
      ) : null}
      {chevron ? <ChevronRight size={18} className="ml-1 shrink-0 text-stone-400" aria-hidden /> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full touch items-center gap-3 rounded-2xl px-1 py-3 text-left transition active:bg-stone-100 ${className ?? ''}`}
      >
        {content}
      </button>
    );
  }

  return <div className={`flex items-center gap-3 px-1 py-3 ${className ?? ''}`}>{content}</div>;
}

/* --- Formularios --------------------------------------------------------- */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="label mb-2 block">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-stone-200 bg-surface px-4 py-3.5 text-[16px] text-ink placeholder:text-stone-400 focus:border-seed-500 focus:outline-none focus:ring-2 focus:ring-seed-500/20 ${className ?? ''}`}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1 rounded-2xl bg-stone-100 p-1 ${className ?? ''}`} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
            value === option.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* --- Personas ------------------------------------------------------------ */

const ACCENT_STYLE: Record<MemberAccent, string> = {
  leaf: 'bg-seed-200 text-seed-900',
  forest: 'bg-forest text-white',
  clay: 'bg-clay/25 text-[#6B4A2E]',
  stone: 'bg-stone-200 text-stone-600',
};

export function Avatar({
  initials,
  accent = 'leaf',
  size = 28,
  className,
}: {
  initials: string;
  accent?: MemberAccent;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${ACCENT_STYLE[accent]} ${className ?? ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/* --- Estados vacíos (§118) ----------------------------------------------- */

export function EmptyState({
  emoji = '🌱',
  title,
  body,
  action,
}: {
  emoji?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-warm px-6 py-12 text-center">
      <span className="mb-3 text-3xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1.5 max-w-[26ch] text-[13px] leading-relaxed text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
