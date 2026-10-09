/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        sans: ['Outfit', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        senior: {
          50: '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        junior: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
        },
        brand: {
          gold: '#f59e0b',
          navy: '#0f172a',
          slate: '#1e293b',
        },
        arcade: {
          gold: '#facc15',
          red: '#ef4444',
          blue: '#2563eb',
          lime: '#84cc16',
        },
      },
      boxShadow: {
        'nb': '3px 3px 0px #000000',
        'nb-sm': '2px 2px 0px #000000',
        'nb-lg': '5px 5px 0px #000000',
        'nb-gold': '3px 3px 0px #f59e0b',
        'nb-blue': '3px 3px 0px #2563eb',
        'nb-emerald': '3px 3px 0px #10b981',
      },
    },
  },
  plugins: [],
};
