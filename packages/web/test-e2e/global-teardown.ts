/**
 * Global teardown for Playwright E2E tests
 *
 * Stops and removes the PostgreSQL container started in global-setup.
 *
 * @module test-e2e/global-teardown
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"

// File where container info was persisted
const CONTAINER_INFO_FILE = path.join(process.cwd(), "test-e2e", ".container-info.json")
const ENV_FILE = path.join(process.cwd(), "test-e2e", ".env.test")

/**
 * Container info persisted between setup and teardown
 */
interface ContainerInfo {
  containerId: string
  dbUrl: string
}

export default async function globalTeardown() {
  console.log("Cleaning up E2E test infrastructure...")

  // Read container info from file
  if (!fs.existsSync(CONTAINER_INFO_FILE)) {
    console.log("No container info file found, skipping cleanup")
    return
  }

  try {
    const containerInfo: ContainerInfo = JSON.parse(
      fs.readFileSync(CONTAINER_INFO_FILE, "utf-8")
    )

    console.log(`Stopping container ${containerInfo.containerId}...`)

    // Stop the container using docker CLI
    // This is more reliable than keeping a container reference across processes
    execSync(`docker stop ${containerInfo.containerId}`, {
      stdio: "pipe",
      timeout: 30000
    })

    console.log("Container stopped.")
  } catch {
    // Container may already be stopped or removed
    console.log("Container cleanup completed (may have already been stopped)")
  }

  // Clean up temp files
  try {
    if (fs.existsSync(CONTAINER_INFO_FILE)) {
      fs.unlinkSync(CONTAINER_INFO_FILE)
    }
    if (fs.existsSync(ENV_FILE)) {
      fs.unlinkSync(ENV_FILE)
    }
    console.log("Temp files cleaned up.")
  } catch {
    // Ignore cleanup errors
  }

  console.log("E2E test teardown complete!")
}
