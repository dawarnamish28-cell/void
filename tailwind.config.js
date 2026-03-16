/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          bg: '#0a0a12',
          panel: '#12121f',
          border: '#1e1e3a',
          accent: '#6c5ce7',
          danger: '#e74c3c',
          success: '#2ecc71',
          warning: '#f39c12',
          text: '#e0e0f0',
          muted: '#6b7280',
        },
      },
      fontFamily: {
        mono: ['Courier Prime', 'Courier New', 'monospace'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
