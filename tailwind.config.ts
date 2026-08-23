import type { Config } from 'tailwindcss';

/**
 * SEMILLA — design tokens.
 *
 * Paleta oficial de marca:
 *   FOREST    #0F2B20
 *   LEAF      #22C55E
 *   SAGE      #E7F1EA
 *   OAT       #FAF8F3
 *   CHARCOAL  #111316
 *
 * La escala `seed` interpola entre SAGE, LEAF y FOREST para poder construir
 * estados sin inventar colores fuera de marca. Ningún componente usa hex sueltos.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Marca
        forest: '#0F2B20',
        leaf: '#22C55E',
        sage: '#E7F1EA',
        oat: '#FAF8F3',
        charcoal: '#111316',

        seed: {
          50: '#F3F9F5',
          100: '#E7F1EA', // SAGE
          200: '#CDE6D6',
          300: '#A3D8B7',
          400: '#63CE8B',
          500: '#22C55E', // LEAF
          600: '#1AA24C',
          700: '#167F3D',
          800: '#125C2E',
          900: '#0F2B20', // FOREST
          950: '#081810',
        },

        bg: '#FAF8F3', // OAT
        surface: '#FFFFFF',
        warm: '#F2EFE7',

        stone: {
          100: '#F0EEE8',
          200: '#E3E0D7',
          300: '#CCC9BE',
          400: '#9C9C93',
          500: '#6B706B',
          600: '#4A4F4A',
        },

        ink: '#111316', // CHARCOAL
        muted: '#6B706B',

        amber: {
          soft: '#D8951F',
          bg: '#FBF2DF',
          deep: '#7C5410',
        },
        coral: {
          DEFAULT: '#C0503F',
          bg: '#FAE9E6',
          deep: '#7E3022',
        },
        clay: '#A9805C',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Inter',
          'Manrope',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      fontSize: {
        hero: ['3.25rem', { lineHeight: '1', letterSpacing: '-0.035em', fontWeight: '700' }],
        display: ['2.25rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        title: ['1.375rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '650' }],
        label: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.09em', fontWeight: '650' }],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(17,19,22,0.04), 0 6px 20px -12px rgba(17,19,22,0.16)',
        raised: '0 2px 6px rgba(17,19,22,0.05), 0 18px 40px -20px rgba(17,19,22,0.28)',
        sheet: '0 -8px 40px -12px rgba(17,19,22,0.24)',
        fab: '0 8px 24px -6px rgba(15,43,32,0.45)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '60%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        rise: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'sheet-in': 'sheet-in 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 200ms ease-out',
        pop: 'pop 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        rise: 'rise 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
