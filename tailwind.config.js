/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'DM Sans', 'sans-serif'] },
      colors: {
        brand: {
          dark: '#1a1a2e',
          gold: '#e8c97e',
          'gold-dim': '#c9a84c',
        },
        surface: {
          base: '#080c18',
          primary: '#0d1120',
          secondary: '#111827',
          tertiary: '#141c30',
          border: '#1a2035',
          'border-light': '#1e2a48',
        },
        text: {
          primary: '#e8eaf6',
          secondary: '#8090c0',
          muted: '#4a5580',
          dim: '#2e3858',
          ghost: '#1e2540',
        },
        status: {
          'green': '#22c55e',
          'green-bg': '#14301a',
          'red': '#ef4444',
          'red-bg': '#2a0f0f',
          'amber': '#f59e0b',
          'amber-bg': '#2a1f00',
          'blue': '#60a5fa',
          'blue-bg': '#0f1e35',
        }
      }
    }
  },
  plugins: []
}
