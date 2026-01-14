/**
 * Server-side API client for SSR
 *
 * This module provides a function to create an API client with a dynamic base URL
 * derived from the current request context. This is required because during SSR,
 * the server runs on a dynamically assigned port, not the fixed port 3000.
 *
 * IMPORTANT: This module should only be imported in server-side code (createServerFn handlers).
 */
import createClient from "openapi-fetch"
import { getRequestUrl } from "@tanstack/react-start/server"
import type { paths } from "./schema.ts"

/**
 * Create an API client configured for the current SSR request
 *
 * Uses getRequestUrl() to determine the correct host/port for API calls.
 * This ensures the API client connects to the same server that received the request.
 */
export function createServerApi() {
  const requestUrl = getRequestUrl()
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`

  return createClient<paths>({
    baseUrl,
    credentials: "include"
  })
}
