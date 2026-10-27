import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1C0770",
        ring: "#261CC1",
        link: "#3A9AFF",
        accent: "#F1FF5E",
        surface: "#EFF6FF",
        surface2: "#DBEAFE",
        night: "#0F0A2A",
        night2: "#1C1A3A",
      },
      fontFamily: {
        serif: ['"Gentium Book Plus"', "serif"],
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        key: "0 2px 8px rgba(28,7,112,0.12)",
        "key-lg": "0 4px 16px rgba(28,7,112,0.18)",
      },
      keyframes: {
        "magic-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(241,255,94,0), 0 2px 8px rgba(28,7,112,0.12)",
          },
          "50%": {
            boxShadow: "0 0 20px 5px rgba(241,255,94,0.55), 0 2px 8px rgba(28,7,112,0.12)",
          },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "magic-pulse": "magic-pulse 2.4s ease-in-out infinite",
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
