import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8001" },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
