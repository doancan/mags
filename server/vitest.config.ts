import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "../test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/services/**", "src/config/**"],
      exclude: [
        "src/tools/**",
        "src/index.ts",
        "src/services/embedding/provider.ts", // Type-only re-export, no runtime code
      ],
    },
  },
});
