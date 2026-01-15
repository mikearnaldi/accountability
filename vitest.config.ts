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
    // Default: 'dot' shows minimal output (dots for passes, details only for failures)
    // Use pnpm test:verbose for full output showing all tests
    reporters: process.env.VERBOSE ? ["verbose"] : ["dot"],
    hookTimeout: 120000, // 2 minutes for testcontainer setup hooks
    // Run tests sequentially within each file to avoid migration race conditions
    // when multiple test files try to create the same PostgreSQL types
    sequence: {
      hooks: "stack"
    },
    // Use forks pool with single thread to ensure migrations run once
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
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
