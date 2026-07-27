/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        calm: "#2f7d6b",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(31, 41, 51, 0.08)",
      },
    },
  },
  plugins: [],
};
