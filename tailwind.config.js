/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        karla: ['Karla', 'sans-serif'],
        roboto: ['Roboto', 'sans-serif'],

        body: ['Karla', 'Inter', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

