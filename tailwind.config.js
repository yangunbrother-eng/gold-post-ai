/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", "sans-serif"]
      },
      colors: {
        carrot: {
          50: "#FFF6F0",
          100: "#FFEAD9",
          500: "#FF6F0F",
          600: "#E55E00",
          700: "#C24E00"
        },
        ink: {
          900: "#111111",
          700: "#333333",
          500: "#666666",
          400: "#8A8A8A",
          300: "#B5B5B5",
          200: "#E5E5E5",
          100: "#F2F2F2",
          50: "#FAFAFA"
        }
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)",
        pop: "0 8px 30px rgba(0,0,0,0.08)"
      },
      borderRadius: {
        xl2: "18px"
      }
    }
  },
  plugins: []
};
