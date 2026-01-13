import { execSync } from "node:child_process"
import * as path from "node:path"

/**
 * Global teardown for Playwright E2E tests
 *
 * Stops and removes the Docker Compose stack.
 */
export default async function globalTeardown() {
  // Navigate from packages/web to project root
  const projectRoot = path.resolve(process.cwd(), "../..")

  console.log("Stopping Docker Compose stack...")

  try {
    execSync("docker compose down", {
      cwd: projectRoot,
      stdio: "inherit",
      timeout: 60000
    })
    console.log("Docker Compose stack stopped.")
  } catch (error) {
    console.error("Failed to stop Docker Compose stack:", error)
    // Don't throw - teardown should be best-effort
  }
}
