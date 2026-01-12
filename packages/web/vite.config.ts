import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { defineConfig } from "vite"
import tsConfigPaths from "vite-tsconfig-paths"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"

export default defineConfig({
  server: {
    port: 3000
  },
  optimizeDeps: {
    // Exclude testcontainers and native dependencies from pre-bundling
    exclude: [
      "@testcontainers/postgresql",
      "testcontainers",
      "dockerode",
      "ssh2",
      "cpu-features"
    ]
  },
  ssr: {
    // Externalize testcontainers and native dependencies in SSR
    external: [
      "@testcontainers/postgresql",
      "testcontainers",
      "dockerode",
      "ssh2",
      "cpu-features"
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
          "cpu-features"
        ]
      }
    })
  ]
})
