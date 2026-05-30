/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#050b14',
        background: '#07111e',
        surface: '#0c1626',
        'surface-2': '#122033',
        'surface-3': '#17273b',
        glass: 'rgba(19, 30, 47, 0.72)',
        line: 'rgba(255, 255, 255, 0.10)',
        soft: '#bfd0e8',
        mint: '#4edea3',
        'mint-strong': '#27c58a',
        sky: '#79c7ff',
        amber: '#f4b860',
        rose: '#ff8d86',
        'text-main': '#d8e6f7',
        'text-soft': '#a8b9ce',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      spacing: {
        sidebar: '280px',
        'shell-gap': '1.25rem',
      },
      boxShadow: {
        soft: '0 24px 80px rgba(0, 0, 0, 0.35)',
        glow: '0 0 24px rgba(78, 222, 163, 0.16)',
      },
      borderRadius: {
        xl2: '1rem',
        xl3: '1.25rem',
      },
    },
  },
  plugins: [],
};
