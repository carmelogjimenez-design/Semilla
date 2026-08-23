/**
 * Lectura tipada de variables de entorno.
 * Nunca se importa aquí ninguna clave privada: sólo las públicas de Supabase.
 *
 * Todo lo que sale de aquí viene ya recortado y validado. Un valor mal pegado
 * (con el nombre de la variable delante, con comillas o con un salto de línea)
 * se trata como «no configurado», nunca como un error que tumbe la aplicación.
 */

function clean(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^["']|["']$/g, '');
}

function looksLikePlaceholder(value: string): boolean {
  return (
    value.startsWith('https://TU-') ||
    value.startsWith('TU_') ||
    value.includes('xxxx.supabase.co') ||
    // Se ha pegado la línea entera del .env en vez de sólo el valor.
    value.includes('NEXT_PUBLIC_')
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function supabaseUrl(): string {
  const value = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!value) {
    throw new Error(
      'Falta NEXT_PUBLIC_SUPABASE_URL. Copia .env.example a .env.local, o añádela en Vercel y vuelve a desplegar.',
    );
  }
  return value.replace(/\/+$/, '');
}

export function supabaseAnonKey(): string {
  const value = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!value) {
    throw new Error(
      'Falta NEXT_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env.local, o añádela en Vercel y vuelve a desplegar.',
    );
  }
  return value;
}

/** Motivo por el que la configuración no sirve. `null` = todo correcto. */
export type ConfigProblem =
  | 'missing-url'
  | 'missing-key'
  | 'placeholder-url'
  | 'placeholder-key'
  | 'invalid-url'
  | null;

export function supabaseConfigProblem(): ConfigProblem {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url) return 'missing-url';
  if (!key) return 'missing-key';
  if (looksLikePlaceholder(url)) return 'placeholder-url';
  if (looksLikePlaceholder(key)) return 'placeholder-key';
  if (!isHttpUrl(url)) return 'invalid-url';
  return null;
}

/** ¿Hay backend configurado? Permite pintar una pantalla de ayuda en vez de reventar. */
export function isSupabaseConfigured(): boolean {
  return supabaseConfigProblem() === null;
}

/** Modo previsualización de interfaz. Sólo desarrollo. */
export function isPreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SEMILLA_PREVIEW === '1';
}

/**
 * URL pública del despliegue, para los enlaces de correo de Supabase.
 * Prioridad: variable explícita → dominio de Vercel → localhost.
 */
export function siteUrl(): string {
  const explicit = clean(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = clean(process.env.NEXT_PUBLIC_VERCEL_URL) || clean(process.env.VERCEL_URL);
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;
  return 'http://localhost:3000';
}
