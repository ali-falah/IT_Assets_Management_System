/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: '#6366f1',
        sidebar: '#0f172a',
        background: '#f8fafc',
        status: {
          available: '#22c55e',
          assigned: '#6366f1',
          maintenance: '#f59e0b',
          retired: '#94a3b8',
        }
      }
    },
  },
  plugins: [],
}

