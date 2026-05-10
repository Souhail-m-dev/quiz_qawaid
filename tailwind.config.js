/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A1F2C',
          light: '#252B3B'
        },
        accent: {
          DEFAULT: '#C5A059',
          light: '#D4AF37'
        },
        bg: '#101827',
        surface: '#1A1F2C',
        beige: '#E6DFD1',
        white: '#F9FAFB',
        ink: '#F9FAFB',
        muted: '#9CA3AF',
        correct: '#10B981',
        incorrect: '#EF4444',
        facile: '#10B981',
        moyenne: '#F59E0B',
        difficile: '#EF4444'
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['Montserrat', 'sans-serif'],
        arabic: ['Amiri', 'serif']
      },
      boxShadow: {
        soft: '0 2px 12px rgba(0, 0, 0, 0.3)',
        card: '0 8px 32px rgba(0, 0, 0, 0.4)',
        gold: '0 0 15px rgba(197, 160, 89, 0.2)'
      }
    }
  },
  plugins: []
};
