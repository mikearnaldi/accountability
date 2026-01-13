/**
 * Vitest Type Augmentation
 *
 * Extends vitest's ProvidedContext to include values provided
 * by globalSetup. This enables type-safe access to shared test
 * infrastructure via inject().
 *
 * @see vitest.global-setup.ts for where these values are provided
 */

declare module "vitest" {
  export interface ProvidedContext {
    /**
     * PostgreSQL connection URL from the shared container.
     * Provided by globalSetup before tests run.
     */
    dbUrl: string
  }
}

export {}
