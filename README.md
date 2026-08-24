<div align="center">

# SEMILLA

**Haz crecer lo que tienes.** · Cada decisión cuenta.

Economía familiar compartida para una pareja.
Next.js · TypeScript strict · Supabase · Vercel · PWA · mobile-first.

</div>

---

## Qué es

Semilla **no** es una app de finanzas personales donde además entra tu pareja.
Es una **economía compartida** en la que cada persona tiene identidad propia: dos correos, dos
sesiones, dos móviles, **los mismos números**.

Todo lo financiero cuelga de un **hogar** (`household`). Nada pertenece a un usuario suelto.
Los permisos se comprueban en PostgreSQL con Row Level Security, no en el navegador.

---

## Estado del proyecto

Semilla se construye **por fases**, y cada fase se despliega.

| Fase | Nombre | Contenido | Estado |
|------|--------|-----------|--------|
| **1** | Late y respira | Migraciones, RLS, auth, hogar, invitaciones, Home, Movimientos, alta de los 5 tipos de movimiento | ✅ |
| **2** | Presupuesto | Pantalla Semana, presupuestos mensual y semanal flexibles, límites por categoría, prioridades | ✅ **esta entrega** |
| 3 | Lo que crece | Huchas, deuda, amortizaciones, gráfico de deuda | ⏳ |
| 4 | Progreso | Objetivos, proyecciones, logros, rachas, patrimonio | ⏳ |
| 5 | Ritmo | Cierre de semana y de mes, histórico, comparativas, insights | ⏳ |
| 6 | Comprometido | Recurrentes, gastos fijos, extraordinarios, calendario de pagos | ⏳ |
| 7 | Vuestro | Categorías, etiquetas, cuentas, ajustes, exportar / importar / copia | ⏳ |
| 8 | Pulido | PWA, accesibilidad AA, rendimiento, microinteracciones | ⏳ |

La base de datos, el modelo de dominio y los cálculos ya están escritos **completos** para todas
las fases: lo que se publica por fases es la interfaz.

---

## Arquitectura

```
Móvil
  ↓
Next.js (App Router, React 19, TypeScript strict)
  ↓
Vercel
  ↓
Supabase  →  PostgreSQL + Auth + RLS + Realtime
```

```
src/
  app/                    Rutas. Server Components salvo lo que necesita interacción.
    (app)/                Zona privada: layout con guarda + carga inicial del hogar
    entrar/ crear-cuenta/ recuperar/ nueva-contrasena/
    invitacion/[token]/   Aceptar invitación
    bienvenida/           Onboarding de un hogar nuevo
    auth/callback/        Retorno de los enlaces de correo de Supabase
  domain/                 Dominio puro: sin React, sin Supabase, testeable
    types.ts              Modelo (Transaction es una discriminated union)
    money.ts              Céntimos. Ninguna operación monetaria usa floats
    dates.ts              Semanas del mes, incluidas las parciales
    calculations.ts       Dinero libre, presupuestos, deuda, ahorro, proyección
    selectors.ts          Del snapshot del hogar a las cifras que pinta la UI
    insights.ts           Frases deterministas, sin IA
    achievements.ts       Logros del hogar
  data/                   Persistencia
    repository.ts         Contrato. La UI nunca habla con Supabase directamente
    supabase-repository.ts Implementación real
    mappers.ts            snake_case ↔ modelo de dominio, en un único sitio
  state/                  Provider con carga, cambios optimistas y Realtime
  components/             Design system y flujos
  screens/                Pantallas
  lib/supabase/           Clientes de navegador y de servidor + tipos de la base
supabase/
  migrations/             Esquema, funciones, RLS, catálogo de logros
  seed.sql                Datos de desarrollo (nunca producción)
```

**Reglas que no se rompen:**

- Todo importe se guarda en **céntimos** (`bigint`). `87,43 € === 8743`.
- Un movimiento es **una fila**. Semana, mes y categoría son agregaciones, no filas nuevas.
- Ninguna cifra de la interfaz está escrita a mano: todas salen del estado.
- Toda tabla financiera lleva `household_id` y su política de RLS.
- `SUPABASE_SERVICE_ROLE_KEY` no aparece en el cliente. No hace falta para el MVP.

---

## Puesta en marcha

### 1. Requisitos

- Node.js 20 o superior
- Una cuenta de Supabase con el proyecto ya creado
- [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar las migraciones

### 2. Instalar

```bash
npm install
cp .env.example .env.local
```

Rellena `.env.local` con los valores de tu proyecto (Supabase → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3. Crear el esquema

Enlaza el proyecto una sola vez y aplica las migraciones:

```bash
supabase login
supabase link --project-ref <TU_PROJECT_REF>
supabase db push
```

Esto crea, en una sola pasada:

- 28 tablas y sus índices
- las políticas RLS de todas ellas
- `create_household()`, `create_invite()`, `accept_invite()`, `invite_preview()`
- los triggers de perfil, autoría y `updated_at`
- las categorías, cuentas y medios de pago por defecto de cada hogar nuevo
- la publicación de Realtime

No hay que crear nada a mano en el panel.

### 4. Lo único que sí se configura en el panel de Supabase

**Authentication → URL Configuration**

| Campo | Valor |
|---|---|
| Site URL | `https://tu-dominio` (o el de Vercel) |
| Redirect URLs | `http://localhost:3000/auth/callback`<br>`https://*.vercel.app/auth/callback`<br>`https://tu-dominio/auth/callback` |

**Authentication → Providers → Email**: deja activado *Enable email provider*.
Si desactivas *Confirm email*, el registro entra directo; si lo dejas activo, Semilla muestra la
pantalla de «revisa tu correo» y el enlace vuelve a `/auth/callback`.

### 5. Desarrollo

```bash
npm run dev          # http://localhost:3000
npm run typecheck    # TypeScript strict, sin errores
npm test             # tests del dominio financiero
```

Con Supabase local (opcional, necesita Docker):

```bash
supabase start
supabase db reset    # aplica migraciones + seed.sql
```

El seed crea dos usuarios que comparten hogar:

```
carmelo@semilla.test  ·  semilla1234
sara@semilla.test     ·  semilla1234
```

### 6. Previsualización de interfaz (solo diseño)

Para revisar pantallas sin backend:

```
NEXT_PUBLIC_SEMILLA_PREVIEW=1
```

y abre `/preview`. Monta la interfaz con un dataset en memoria. **No guarda nada** y no debe
activarse en producción.

---

## Despliegue en Vercel

1. Importa el repositorio en Vercel. Framework: Next.js (se detecta solo).
2. Añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en **Production**,
   **Preview** y **Development**.
3. Opcional: `NEXT_PUBLIC_SITE_URL` con el dominio definitivo, para que los enlaces de los correos
   de Supabase apunten ahí.
4. Añade el dominio de producción y el comodín de preview a las Redirect URLs de Supabase.
5. Cada `git push` despliega: `main` a producción, ramas a preview.

No hay dominio escrito en el código: la app resuelve su URL desde la petición o desde `VERCEL_URL`.

---

## Seguridad

Cada tabla financiera tiene esta política, sin excepciones:

```sql
using (public.is_household_member(household_id))
```

`is_household_member()` es `SECURITY DEFINER` y comprueba `auth.uid()` contra
`household_members`. Consecuencias:

- Un usuario del hogar A **no puede** leer, editar ni borrar nada del hogar B, aunque adivine un
  `id` o llame a la API directamente con su token.
- La creación de hogares y la aceptación de invitaciones pasan por funciones controladas, no por
  `insert` abiertos.
- El registro crea el perfil por trigger; el usuario no puede fabricarse uno ajeno.

Comprobación manual recomendada tras el primer despliegue:

1. Registra a Carmelo. Crea «Familia García».
2. Invita a Sara. Regístrala con su correo y acepta la invitación.
3. Sara registra un gasto de 92 €. Carmelo lo ve sin recargar (Realtime).
4. Carmelo registra un ingreso. Sara lo ve.
5. Los totales de Inicio son idénticos en los dos móviles.
6. Crea un tercer usuario con un hogar propio: no debe ver nada de Familia García.

---

## Modelo de datos, en corto

- `profiles`, `households`, `household_members`, `household_invites`, `user_preferences`
- `accounts`, `payment_methods`, `categories`, `subcategories`, `tags`, `merchants`,
  `income_sources`
- `transactions` (+ `transaction_tags`) — cinco tipos: `income`, `expense`, `saving`,
  `debt_payment`, `internal_transfer`, con un `CHECK` que obliga a que cada tipo traiga sus campos
- `recurring_transactions` (vista `fixed_expenses`), `monthly_budgets`, `weekly_budgets`,
  `budget_categories`
- `savings_pockets`, `debts` (vista `debt_payments`), `goals`
- `achievements`, `household_achievements`, `weekly_closes`, `monthly_closes`, `notifications`,
  `quick_actions`, `app_settings`

Las vistas existen por comodidad de consulta y **no duplican datos**.

---

## Idioma y tono

Toda la app está en español, con lenguaje adulto y directo. Un mes caro no es un fracaso: es un mes
con contexto. Si os habéis pasado, Semilla lo dice, y dice por qué.

> Lo importante no es gastar perfecto. Es saber dónde estáis.
