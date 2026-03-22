/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0a0a0a',
        gold: '#d4af37',
        wine: '#5b1826',
        night: '#111111',
        mist: '#e7ddc2',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        body: ['"Manrope"', 'sans-serif'],
      },
      boxShadow: {
        luxe: '0 18px 55px rgba(0, 0, 0, 0.45)',
      },
      backgroundImage: {
        velvet:
          'radial-gradient(circle at top, rgba(212, 175, 55, 0.2), transparent 32%), radial-gradient(circle at bottom, rgba(91, 24, 38, 0.22), transparent 28%), linear-gradient(180deg, #111111 0%, #0a0a0a 48%, #090909 100%)',
      },
      keyframes: {
        fadeUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(24px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        pulseGlow: {
          '0%, 100%': {
            boxShadow: '0 0 0 rgba(212, 175, 55, 0)',
          },
          '50%': {
            boxShadow: '0 0 32px rgba(212, 175, 55, 0.18)',
          },
        },
      },
      animation: {
        'fade-up': 'fadeUp 700ms ease forwards',
        'pulse-glow': 'pulseGlow 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

