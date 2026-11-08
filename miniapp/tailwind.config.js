/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#050816',
        neon: '#7c3aed',
        accent: '#22d3ee',
        glow: '#16a34a'
      }
    }
  },
  plugins: []
};
