/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // theme toggled by adding/removing `dark` on <html>
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          500: "#3b6fe0",
          600: "#2f59c4",
          700: "#264a9e",
        },
      },
    },
  },
  plugins: [],
};
