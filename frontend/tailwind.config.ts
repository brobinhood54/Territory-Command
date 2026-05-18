import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080e1a',
        surface: '#0f1929',
        border: '#1e3048',
        'text-primary': '#dde6ee',
        muted: '#6b8599',
        accent: '#00e5a0',
        cyan: '#00c2d4',
        amber: '#f0a500',
        danger: '#e06050',
      },
    },
  },
  plugins: [],
} satisfies Config;
