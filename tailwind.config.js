/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B3A5C',
          light: '#2E5F8A'
        },
        accent: {
          DEFAULT: '#C9A84C',
          light: '#F0D080'
        },
        bg: '#F5F0E8',
        surface: '#FFFFFF',
        ink: '#1A1A1A',
        muted: '#6B7280',
        correct: '#16A34A',
        incorrect: '#DC2626',
        facile: '#16A34A',
        moyenne: '#D97706',
        difficile: '#DC2626'
      },
      fontFamily: {
        display: ['Amiri', 'Georgia', 'serif'],
        body: ['"Noto Serif"', 'Georgia', 'serif']
      },
      boxShadow: {
        soft: '0 2px 12px rgba(27, 58, 92, 0.08)',
        card: '0 4px 24px rgba(27, 58, 92, 0.10)'
      }
    }
  },
  plugins: []
};
