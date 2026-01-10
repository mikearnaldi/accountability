import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts"],
    exclude: [
      "repos/**",
      "**/node_modules/**"
    ],
    passWithNoTests: true,
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
