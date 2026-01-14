/**
 * API Interceptor - Re-export the base API client
 *
 * The API client is configured with `credentials: "include"` so it automatically
 * sends httpOnly cookies set by the server.
 *
 * For authenticated requests via bearer tokens, the client stores the session token
 * in localStorage after a successful login, and this should be sent as an Authorization
 * header in subsequent requests.
 *
 * @module api/interceptor
 */

export { api } from "./client.ts"
export type { paths, ApiClient } from "./client.ts"
