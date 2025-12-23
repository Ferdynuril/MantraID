/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",          // Semua file EJS
    "./routes/**/*.js",          // File route (jika ada JSX/HTML)
    "./public/**/*.html",        // File HTML statis
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        dark: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}