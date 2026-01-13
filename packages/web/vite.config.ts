import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { defineConfig } from "vite"
import tsConfigPaths from "vite-tsconfig-paths"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"

export default defineConfig({
  server: {
    port: 3000
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
      "pg-native"
    ]
  },
  plugins: [
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
          "pg-native"
        ]
      }
    })
  ]
})
