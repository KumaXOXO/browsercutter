import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:           '#07070F',
        surface:      '#0E0E1C',
        surface2:     '#141428',
        surface3:     '#1C1C34',
        borderSubtle: 'rgba(255,255,255,0.07)',
        brand:        '#E11D48',
        mutedSubtle:  '#5A5A7A',
        muted2:       '#888898',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
