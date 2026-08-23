import type { CSSProperties } from 'react';

/**
 * Identidad SEMILLA.
 * Símbolo: anillo abierto + monograma S que se convierte en brote, con punto LEAF.
 */

export type LogoTone = 'forest' | 'light';

export function SemillaMark({
  size = 28,
  tone = 'forest',
  className,
  style,
}: {
  size?: number;
  tone?: LogoTone;
  className?: string;
  style?: CSSProperties;
}) {
  const stroke = tone === 'light' ? '#FFFFFF' : '#0F2B20';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label="Semilla"
    >
      <path d="M78.58 33.5A33 33 0 1 1 60.2 18.62" stroke={stroke} strokeWidth={5.6} strokeLinecap="round" />
      <path
        d="M63 33C61 26 50 23 43 27c-9 5-9 16 0 21 6 3 7 8 7 14v17"
        stroke={stroke}
        strokeWidth={5.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M50 67c-11 0-17-6-17-15 10-1 17 5 17 15Z" fill={stroke} />
      <path d="M50 62c0-10 6-16 16-15 0 9-6 15-16 15Z" fill={stroke} />
      <circle cx="70.8" cy="24.4" r="6.6" fill="#22C55E" />
    </svg>
  );
}

export function SemillaWordmark({ tone = 'forest', className }: { tone?: LogoTone; className?: string }) {
  return (
    <span
      className={`select-none font-medium ${tone === 'light' ? 'text-white' : 'text-forest'} ${className ?? ''}`}
      style={{ letterSpacing: '0.32em', marginRight: '-0.32em' }}
    >
      SEMILLA
    </span>
  );
}

export function SemillaLogo({
  size = 26,
  tone = 'forest',
  className,
}: {
  size?: number;
  tone?: LogoTone;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <SemillaMark size={size} tone={tone} />
      <SemillaWordmark tone={tone} className="text-[13px]" />
    </span>
  );
}
