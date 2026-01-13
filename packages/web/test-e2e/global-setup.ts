import { execSync } from "node:child_process"
import * as path from "node:path"

/**
 * Global setup for Playwright E2E tests
 *
 * Builds and starts the Docker Compose stack, waits for services to be healthy.
 */
export default async function globalSetup() {
  // Navigate from packages/web to project root
  const projectRoot = path.resolve(process.cwd(), "../..")

  console.log("Building and starting Docker Compose stack...")

  try {
    // Build and start containers in detached mode
    execSync("docker compose up -d --build --wait", {
      cwd: projectRoot,
      stdio: "inherit",
      timeout: 300000 // 5 minute timeout for build
    })

    // Wait for the app to be ready by polling the health endpoint
    console.log("Waiting for app to be ready...")
    await waitForApp("http://localhost:3000", 60000)

    console.log("Docker Compose stack is ready!")
  } catch (error) {
    console.error("Failed to start Docker Compose stack:", error)
    // Try to get logs for debugging
    try {
      execSync("docker compose logs", { cwd: projectRoot, stdio: "inherit" })
    } catch {
      // Ignore errors getting logs
    }
    throw error
  }
}

async function waitForApp(url: string, timeoutMs: number): Promise<void> {
  const startTime = Date.now()
  const pollInterval = 1000

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // App not ready yet, continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  throw new Error(`App at ${url} did not become ready within ${timeoutMs}ms`)
}
