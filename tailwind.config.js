/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mansion: {
          base: '#08080E',
          card: '#111118',
          elevated: '#1A1A24',
          border: '#2A2A38',
          gold: '#C9A84C',
          'gold-light': '#E0C97A',
          crimson: '#D4183D',
          'crimson-dark': '#9B1C3A',
          'crimson-glow': 'rgba(212, 24, 61, 0.15)',
          'gold-glow': 'rgba(201, 168, 76, 0.12)',
        },
        text: {
          primary: '#F0EDE8',
          muted: '#888899',
          dim: '#555566',
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mansion': 'linear-gradient(135deg, #08080E 0%, #1A1A24 50%, #08080E 100%)',
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(201, 168, 76, 0.15)',
        'glow-crimson': '0 0 20px rgba(212, 24, 61, 0.2)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'elevated': '0 8px 32px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-out': 'fadeOut 0.3s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateX(-50%) translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      }
    },
  },
  plugins: [],
}
