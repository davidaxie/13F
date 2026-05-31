import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig.json's "@/*": ["./src/*"] so test files can import
      // app code with the same paths as the runtime app.
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Pick up *.test.ts colocated with source modules under src/, plus
    // standalone test files under tests/ (used for unit tests targeting
    // specific library helpers — e.g. edgar value-scaling).
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Don't try to run Next.js app code in the test environment — node is
    // fine for the pure-math modules we're testing.
    environment: "node",
  },
});
