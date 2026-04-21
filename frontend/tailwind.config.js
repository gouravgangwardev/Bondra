/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary':     '#F8F7F3',
        'bg-secondary':   '#EFEDE6',
        'bg-surface':     '#FFFFFF',
        'text-primary':   '#2E2E2E',
        'text-secondary': '#6C6C6C',
        'text-disabled':  '#A0A0A0',
        'primary':        '#6B705C',
        'primary-hover':  '#5A5F4E',
        'accent':         '#A5A58D',
        'border-default': '#E0DED9',
        'border-subtle':  '#ECEAE4',
      },
    },
  },
  plugins: [],
};
