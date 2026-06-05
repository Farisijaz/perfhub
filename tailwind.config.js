/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['DM Sans', 'sans-serif'] },
      colors: { brand: { dark: '#1a1a2e', gold: '#e8c97e' } }
    }
  },
  plugins: []
}
