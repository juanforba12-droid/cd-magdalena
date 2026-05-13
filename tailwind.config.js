/** @type {import('tailwindcss').Config} */
export default {
  safelist: [
    'bg-red-600','border-red-400',
    'bg-yellow-500','border-yellow-300',
    'bg-blue-600','border-blue-400',
    'bg-green-600','border-green-400',
  ],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
