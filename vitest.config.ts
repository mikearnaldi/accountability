import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@accountability/core": path.resolve(__dirname, "packages/core/src"),
      "@accountability/persistence": path.resolve(__dirname, "packages/persistence/src"),
      "@accountability/api": path.resolve(__dirname, "packages/api/src"),
      "@accountability/web": path.resolve(__dirname, "packages/web/src")
    }
  },
  test: {
    globalSetup: ["./vitest.global-setup.ts"],
    include: ["packages/**/test/**/*.test.ts", "packages/**/test/**/*.test.tsx"],
    exclude: [
      "repos/**",
      "**/node_modules/**"
    ],
    passWithNoTests: true,
    hookTimeout: 120000, // 2 minutes for testcontainer setup hooks
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["packages/**/src/**/*.ts"],
      exclude: [
        "repos/**",
        "**/node_modules/**",
        "packages/**/test/**",
        "**/*.d.ts"
      ]
    }
  }
})
