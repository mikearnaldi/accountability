import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts"],
    exclude: ["repos/**", "node_modules/**"],
    passWithNoTests: true
  }
})
