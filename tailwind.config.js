/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf8f4',
          100: '#f7ede6',
          200: '#ead6c6',
          300: '#dcbfa6',
          400: '#c4a484',
          500: '#a58163',
          600: '#8d6d53',
          700: '#745842',
          800: '#5b4533',
          900: '#423224',
        }
      }
    },
  },
  plugins: [],
}
