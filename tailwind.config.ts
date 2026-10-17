import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#04060e',
        abyss: '#060b1c',
        navy: {
          DEFAULT: '#0a1230',
          800: '#0b1533',
          700: '#101d42',
          600: '#16265a',
        },
        electric: {
          200: '#a5d8ff',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#2f8bff',
          600: '#2563eb',
        },
        neon: '#22e0ff',
        mint: '#34d399',
        amber: '#fbbf24',
        coral: '#fb7185',
        violet: '#8b5cf6',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        floaty: 'floaty 7s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
