/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'orbitron': ['Orbitron', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      dropShadow: {
        'glow': '0 0 20px rgba(0, 243, 255, 0.6)',
        'glow-red': '0 0 20px rgba(255, 0, 0, 0.6)',
        'glow-yellow': '0 0 20px rgba(255, 255, 0, 0.6)',
      }
    },
  },
  plugins: [],
}