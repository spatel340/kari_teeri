import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#060913",
          900: "#0b1220",
          800: "#101827",
        },
        gold: {
          200: "#f8db9f",
          300: "#f2c46a",
          400: "#d8a53d",
        },
        felt: {
          900: "#042c32",
          800: "#0a3a45",
          700: "#0f4c5b",
        },
      },
      fontFamily: {
        display: ["Cormorant Garamond", "serif"],
        body: ["Space Grotesk", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.45)",
        card: "0 18px 38px rgba(5, 8, 18, 0.45), inset 0 1px 0 rgba(255,255,255,0.65)",
        felt: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -28px 80px rgba(0,0,0,0.28), 0 28px 70px rgba(0,0,0,0.45)",
      },
      backgroundImage: {
        "hero-grid":
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseSoft: "pulseSoft 2.8s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.5", transform: "scale(0.98)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
