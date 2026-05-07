/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        'surface-dark': '#1a1a2e',
        'surface-light': '#fafafa',
        accent: '#f59e0b',
        'status-alive': '#22c55e',
        'status-dead': '#ef4444',
        'status-stale': '#f59e0b',
        'status-duplicate': '#3b82f6',
        'status-unknown': '#9ca3af',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
