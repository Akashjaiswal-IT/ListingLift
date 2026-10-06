import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // Keep tests fast and deterministic: no watch in CI, isolate modules.
    globals: true,
  },
});
