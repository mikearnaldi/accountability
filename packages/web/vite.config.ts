import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { defineConfig } from "vite"
import tsConfigPaths from "vite-tsconfig-paths"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  server: {
    port: 3000
  },
  // Build-time replacement enables dead code elimination for conditional imports
  // This allows the bundler to tree-shake out handler.dev.ts (testcontainers) in production
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development")
  },
  css: {
    // Disable lightningcss transformer - incompatible with Tailwind v4 syntax
    transformer: "postcss"
  },
  // Apply manualChunks only to client build (not SSR/nitro which uses advancedChunks)
  environments: {
    client: {
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes("node_modules")) {
                if (id.includes("/effect/")) {
                  return "vendor-effect"
                }
                if (id.includes("/@effect/platform")) {
                  return "vendor-effect-platform"
                }
                if (id.includes("/@effect-atom/")) {
                  return "vendor-effect-atom"
                }
                if (id.includes("/@tanstack/react-router")) {
                  return "vendor-tanstack"
                }
                if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
                  return "vendor-react"
                }
              }
            }
          }
        }
      }
    }
  },
  optimizeDeps: {
    // Exclude testcontainers and native dependencies from pre-bundling
    exclude: [
      "@testcontainers/postgresql",
      "testcontainers",
      "dockerode",
      "ssh2",
      "cpu-features",
      "pg",
      "pg-pool",
      "pg-native"
    ]
  },
  ssr: {
    // Externalize testcontainers and native dependencies in SSR
    external: [
      "@testcontainers/postgresql",
      "testcontainers",
      "dockerode",
      "ssh2",
      "cpu-features",
      "pg",
      "pg-pool",
      "pg-native",
      "@effect/sql",
      "@effect/sql-pg"
    ]
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"]
    }),
    tanstackStart({
      srcDirectory: "src"
    }),
    viteReact(),
    nitro({
      rollupConfig: {
        external: [
          // Externalize testcontainers and its native dependencies
          // These are only used in dev mode and should not be bundled
          "@testcontainers/postgresql",
          "testcontainers",
          "dockerode",
          "ssh2",
          "cpu-features",
          // Externalize pg and related packages - native bindings don't bundle well
          "pg",
          "pg-pool",
          "pg-native",
          // Externalize Effect SQL packages - only used on server
          "@effect/sql",
          "@effect/sql-pg"
        ]
      }
    })
  ]
})
