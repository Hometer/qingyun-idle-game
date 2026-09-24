import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f4f1ea",
        card: "#fffdf8",
        ink: "#2b2620",
        cinnabar: "#b3402a",
        gold: "#b7954a",
        line: "#e2d9c8",
        muted: "#8a7a55",
      },
    },
  },
  plugins: [],
};

export default config;
