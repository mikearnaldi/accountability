/**
 * Auth Atoms - State management for authentication
 *
 * This module provides Effect Atom based state management for authentication state
 * with multi-provider support. It handles:
 * - Session token persistence to localStorage
 * - Automatic token inclusion in API requests
 * - User authentication state management
 * - Login/logout/register mutations
 * - Provider identity linking
 * - Auto-clear token on 401 responses
 *
 * @module auth
 */

import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import { HttpClient, HttpClientRequest } from "@effect/platform"
import type { AuthProviderType } from "@accountability/core/Auth/AuthProviderType"
import { SessionId } from "@accountability/core/Auth/SessionId"
import type { UserIdentityId } from "@accountability/core/Auth/UserIdentity"
import {
  AuthUserResponse,
  AuthorizeRedirectResponse,
  LoginResponse,
  ProvidersResponse
} from "@accountability/api/Definitions/AuthApi"
import type {
  ProviderMetadata
} from "@accountability/api/Definitions/AuthApi"
import * as Cause from "effect/Cause"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { atomRuntime } from "./runtime.ts"

// =============================================================================
// Constants
// =============================================================================

const AUTH_TOKEN_KEY = "accountability_auth_token"
const AUTH_LINK_FLOW_KEY = "auth_link_flow"

// =============================================================================
// Storage Helpers (localStorage persistence)
// =============================================================================

/**
 * Gets the stored auth token from localStorage
 * Uses Schema.decodeUnknownOption to safely validate the stored value
 */
const getStoredToken = (): Option.Option<SessionId> => {
  if (typeof window === "undefined") {
    return Option.none()
  }
  const stored = window.localStorage.getItem(AUTH_TOKEN_KEY)
  if (stored === null || stored === "") {
    return Option.none()
  }
  // Use Schema to validate the stored token
  return Schema.decodeUnknownOption(SessionId)(stored)
}

/**
 * Persists the auth token to localStorage
 */
const storeToken = (token: SessionId): void => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  }
}

/**
 * Clears the auth token from localStorage
 */
const clearStoredToken = (): void => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  }
}

/**
 * Sets the link flow flag in session storage
 * This flag is checked by the callback page to determine flow type
 */
export const setLinkFlowFlag = (): void => {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(AUTH_LINK_FLOW_KEY, "true")
  }
}

/**
 * Gets the base URL for API calls
 */
const getBaseUrl = (): string =>
  typeof window !== "undefined" ? window.location.origin : ""

/**
 * API Error schema for validating error responses
 * All API errors have a _tag discriminator
 */
const ApiError = Schema.Struct({
  _tag: Schema.String
}).annotations({ identifier: "ApiError" })

// =============================================================================
// Auth Token Atom
// =============================================================================

/**
 * authTokenAtom - Stores current session token (persisted to localStorage)
 *
 * This is a writable atom that stores the current session token. The token
 * is persisted to localStorage across sessions. Setting the token to None
 * clears it from storage.
 *
 * Usage:
 * ```typescript
 * // Read token
 * const token = useAtomValue(authTokenAtom)
 *
 * // Set token after login
 * const setToken = useSetAtom(authTokenAtom)
 * setToken(Option.some(sessionToken))
 *
 * // Clear token on logout
 * setToken(Option.none())
 * ```
 */
export const authTokenAtom: Atom.Writable<Option.Option<SessionId>, Option.Option<SessionId>> = Atom.writable(
  (_get) => {
    // Initialize from localStorage
    return getStoredToken()
  },
  (ctx, token: Option.Option<SessionId>) => {
    // Persist to localStorage
    Option.match(token, {
      onNone: () => clearStoredToken(),
      onSome: storeToken
    })
    ctx.setSelf(token)
  }
).pipe(Atom.keepAlive) // Keep alive to maintain token across unmounts

// =============================================================================
// Current User Atoms
// =============================================================================

/**
 * fetchUserFamily - Memoized atom family for fetching user data by token
 *
 * Using Atom.family ensures the same atom instance is returned for the same
 * token value, preventing infinite refetch loops.
 */
const fetchUserFamily = Atom.family((token: SessionId) =>
  atomRuntime.atom(
    Effect.gen(function*() {
      const client = yield* HttpClient.HttpClient
      const request = HttpClientRequest.get(`${getBaseUrl()}/api/auth/me`).pipe(
        HttpClientRequest.bearerToken(token)
      )
      const response = yield* client.execute(request)

      if (response.status === 401) {
        // Token is invalid - will be cleared by the consumer
        return yield* Effect.fail({ _tag: "Unauthorized" as const })
      }

      const body = yield* response.json
      return yield* Schema.decodeUnknown(AuthUserResponse)(body)
    })
  ).pipe(
    Atom.setIdleTTL(Duration.minutes(5)) // Cache for 5 minutes
  )
)

/**
 * currentUserAtom - Async atom that fetches /api/auth/me when token exists
 *
 * This atom automatically fetches the current user's details when a valid
 * token exists. When the token is cleared or missing, it returns an initial
 * state.
 *
 * The atom depends on authTokenAtom and automatically refetches when the
 * token changes.
 */
export const currentUserAtom: Atom.Atom<Result.Result<AuthUserResponse, unknown>> = Atom.readable((get) => {
  const tokenOption = get(authTokenAtom)

  // If no token, return initial state
  if (Option.isNone(tokenOption)) {
    return Result.initial<AuthUserResponse, unknown>()
  }

  const token = tokenOption.value

  // Use family to get memoized atom for this token
  const userResult = get(fetchUserFamily(token))

  // If we got a 401, clear the token
  if (Result.isFailure(userResult)) {
    const errorOption = Cause.failureOption(userResult.cause)
    if (Option.isSome(errorOption) && (errorOption.value as { _tag?: string })._tag === "Unauthorized") {
      clearStoredToken()
      get.set(authTokenAtom, Option.none())
    }
  }

  return userResult
})

/**
 * userIdentitiesAtom - Derived from currentUserAtom, lists linked providers
 *
 * Returns the list of UserIdentity records linked to the current user.
 * Useful for showing which auth providers the user has connected.
 */
export const userIdentitiesAtom = Atom.readable((get) => {
  const userResult = get(currentUserAtom)

  return Result.map(userResult, (response) => response.identities)
})

/**
 * isAuthenticatedAtom - Derived boolean from currentUserAtom
 *
 * Returns true when the user is authenticated (has a valid token and
 * the user data has been successfully fetched).
 */
export const isAuthenticatedAtom: Atom.Atom<boolean> = Atom.readable((get) => {
  const tokenOption = get(authTokenAtom)
  const userResult = get(currentUserAtom)

  // User is authenticated if:
  // 1. Token exists
  // 2. User data fetch was successful
  return Option.isSome(tokenOption) && Result.isSuccess(userResult)
})

// =============================================================================
// Enabled Providers Atom
// =============================================================================

/**
 * enabledProvidersAtom - Async atom that fetches /api/auth/providers
 *
 * Fetches the list of enabled authentication providers. This is a public
 * endpoint that doesn't require authentication.
 *
 * The result is cached and can be refreshed by calling Atom.refresh.
 */
export const enabledProvidersAtom = atomRuntime.atom(
  Effect.gen(function*() {
    const client = yield* HttpClient.HttpClient
    const request = HttpClientRequest.get(`${getBaseUrl()}/api/auth/providers`)
    const response = yield* client.execute(request)
    const body = yield* response.json
    const providersResponse = yield* Schema.decodeUnknown(ProvidersResponse)(body)
    return providersResponse.providers
  })
).pipe(
  Atom.setIdleTTL(Duration.minutes(30)), // Cache providers for longer
  Atom.keepAlive // Keep alive as it's needed for login page
)

// =============================================================================
// Auth Mutations
// =============================================================================

/**
 * Local login credentials - plain strings validated on server
 */
export interface LocalLoginInput {
  readonly email: string
  readonly password: string
}

/**
 * OAuth login credentials - authorization code and state
 */
export interface OAuthLoginInput {
  readonly code: string
  readonly state: string
}

/**
 * Credentials type for loginMutation
 */
export type LoginCredentials =
  | { readonly provider: "local"; readonly credentials: LocalLoginInput }
  | { readonly provider: AuthProviderType; readonly credentials: OAuthLoginInput }

/**
 * loginMutation - Calls login API, stores token on success
 *
 * Usage:
 * ```typescript
 * const loginMutation = useAtomValue(loginMutation)
 * const setLogin = useSetAtom(loginMutation)
 *
 * // Local login
 * setLogin({
 *   provider: "local",
 *   credentials: { email: "user@example.com", password: "password" }
 * })
 * ```
 */
export const loginMutation = atomRuntime.fn<LoginCredentials>()(
  (input, get) =>
    Effect.gen(function*() {
      const client = yield* HttpClient.HttpClient
      const request = yield* HttpClientRequest.post(`${getBaseUrl()}/api/auth/login`).pipe(
        HttpClientRequest.bodyJson({
          provider: input.provider,
          credentials: input.credentials
        })
      )
      const response = yield* client.execute(request)

      if (!response.status.toString().startsWith("2")) {
        const errorBody = yield* response.json
        const apiError = yield* Schema.decodeUnknown(ApiError)(errorBody)
        return yield* Effect.fail(apiError)
      }

      const body = yield* response.json
      const loginResponse = yield* Schema.decodeUnknown(LoginResponse)(body)

      // Store the token on successful login
      storeToken(loginResponse.token)
      get.set(authTokenAtom, Option.some(loginResponse.token))

      // Refresh the current user atom
      get.refresh(currentUserAtom)

      return loginResponse
    })
)

/**
 * oauthLoginMutation - Initiates OAuth flow (redirects to authorize URL)
 *
 * This mutation fetches the OAuth authorization URL for the specified provider
 * and returns it. The caller should redirect the user to this URL.
 *
 * Usage:
 * ```typescript
 * const result = useAtomValue(oauthLoginMutation)
 * const initiateOAuth = useSetAtom(oauthLoginMutation)
 *
 * // Start OAuth flow
 * const response = await initiateOAuth("google")
 * window.location.href = response.redirectUrl
 * ```
 */
export const oauthLoginMutation = atomRuntime.fn<AuthProviderType>()(
  (provider) =>
    Effect.gen(function*() {
      const client = yield* HttpClient.HttpClient
      const request = HttpClientRequest.get(`${getBaseUrl()}/api/auth/authorize/${provider}`)
      const response = yield* client.execute(request)

      if (!response.status.toString().startsWith("2")) {
        const errorBody = yield* response.json
        const apiError = yield* Schema.decodeUnknown(ApiError)(errorBody)
        return yield* Effect.fail(apiError)
      }

      const body = yield* response.json
      return yield* Schema.decodeUnknown(AuthorizeRedirectResponse)(body)
    })
)

/**
 * logoutMutation - Calls logout API, clears token
 *
 * Invalidates the current session and clears the stored token.
 *
 * Usage:
 * ```typescript
 * const logoutResult = useAtomValue(logoutMutation)
 * const logout = useSetAtom(logoutMutation)
 *
 * // Logout
 * logout()
 * ```
 */
export const logoutMutation = atomRuntime.fn<void>()(
  (_input, get) =>
    Effect.gen(function*() {
      const tokenOption = get(authTokenAtom)

      if (Option.isNone(tokenOption)) {
        // Already logged out
        return
      }

      const token = tokenOption.value

      const client = yield* HttpClient.HttpClient
      const request = HttpClientRequest.post(`${getBaseUrl()}/api/auth/logout`).pipe(
        HttpClientRequest.bearerToken(token)
      )
      const response = yield* client.execute(request)

      // Clear token regardless of response (even if server fails)
      clearStoredToken()
      get.set(authTokenAtom, Option.none())

      // Refresh current user to clear it
      get.refresh(currentUserAtom)

      if (!response.status.toString().startsWith("2") && response.status !== 401) {
        const errorBody = yield* response.json
        const apiError = yield* Schema.decodeUnknown(ApiError)(errorBody)
        return yield* Effect.fail(apiError)
      }
    })
)

// =============================================================================
// Registration Mutation
// =============================================================================

/**
 * RegisterInput - Input for registerMutation
 */
export interface RegisterInput {
  readonly email: string
  readonly password: string
  readonly displayName: string
}

/**
 * registerMutation - Calls register API (local provider)
 *
 * Registers a new user with email/password authentication.
 * Does NOT automatically log in - the user should call loginMutation after.
 *
 * Usage:
 * ```typescript
 * const registerResult = useAtomValue(registerMutation)
 * const register = useSetAtom(registerMutation)
 *
 * register({
 *   email: "user@example.com",
 *   password: "securePassword123",
 *   displayName: "John Doe"
 * })
 * ```
 */
export const registerMutation = atomRuntime.fn<RegisterInput>()(
  (input) =>
    Effect.gen(function*() {
      const client = yield* HttpClient.HttpClient
      const request = yield* HttpClientRequest.post(`${getBaseUrl()}/api/auth/register`).pipe(
        HttpClientRequest.bodyJson({
          email: input.email,
          password: input.password,
          displayName: input.displayName
        })
      )
      const response = yield* client.execute(request)

      if (!response.status.toString().startsWith("2")) {
        const errorBody = yield* response.json
        const apiError = yield* Schema.decodeUnknown(ApiError)(errorBody)
        return yield* Effect.fail(apiError)
      }

      const body = yield* response.json
      return yield* Schema.decodeUnknown(AuthUserResponse)(body)
    })
)

// =============================================================================
// Provider Linking Mutations
// =============================================================================

/**
 * linkProviderMutation - Initiates provider linking for logged-in user
 *
 * Returns the OAuth authorization URL for linking an additional provider
 * to the current user's account.
 *
 * IMPORTANT: Before redirecting, you must call `setLinkFlowFlag()` to mark
 * this as a link flow. The callback page uses this to determine whether to
 * create a new session or just link the provider to the existing account.
 *
 * Usage:
 * ```typescript
 * import { linkProviderMutation, setLinkFlowFlag } from "../atoms/auth"
 *
 * const linkResult = useAtomValue(linkProviderMutation)
 * const linkProvider = useSetAtom(linkProviderMutation)
 *
 * // Start linking Google account
 * const response = await linkProvider("google")
 * setLinkFlowFlag() // Mark as link flow for the callback page
 * window.location.href = response.redirectUrl
 * ```
 */
export const linkProviderMutation = atomRuntime.fn<AuthProviderType>()(
  (provider, get) =>
    Effect.gen(function*() {
      const tokenOption = get(authTokenAtom)

      if (Option.isNone(tokenOption)) {
        return yield* Effect.fail({ _tag: "NotAuthenticated" as const, message: "Must be logged in to link provider" })
      }

      const token = tokenOption.value

      const client = yield* HttpClient.HttpClient
      const request = HttpClientRequest.post(`${getBaseUrl()}/api/auth/link/${provider}`).pipe(
        HttpClientRequest.bearerToken(token)
      )
      const response = yield* client.execute(request)

      if (!response.status.toString().startsWith("2")) {
        const errorBody = yield* response.json
        const apiError = yield* Schema.decodeUnknown(ApiError)(errorBody)
        return yield* Effect.fail(apiError)
      }

      const body = yield* response.json
      return yield* Schema.decodeUnknown(AuthorizeRedirectResponse)(body)
    })
)

/**
 * unlinkProviderMutation - Removes linked provider
 *
 * Removes a linked provider identity from the current user's account.
 * Users must maintain at least one linked identity.
 *
 * Usage:
 * ```typescript
 * const unlinkResult = useAtomValue(unlinkProviderMutation)
 * const unlinkProvider = useSetAtom(unlinkProviderMutation)
 *
 * // Remove a linked identity
 * unlinkProvider(identityId)
 * ```
 */
export const unlinkProviderMutation = atomRuntime.fn<UserIdentityId>()(
  (identityId, get) =>
    Effect.gen(function*() {
      const tokenOption = get(authTokenAtom)

      if (Option.isNone(tokenOption)) {
        return yield* Effect.fail({ _tag: "NotAuthenticated" as const, message: "Must be logged in to unlink provider" })
      }

      const token = tokenOption.value

      const client = yield* HttpClient.HttpClient
      const request = HttpClientRequest.del(`${getBaseUrl()}/api/auth/identities/${identityId}`).pipe(
        HttpClientRequest.bearerToken(token)
      )
      const response = yield* client.execute(request)

      if (!response.status.toString().startsWith("2")) {
        const errorBody = yield* response.json
        const apiError = yield* Schema.decodeUnknown(ApiError)(errorBody)
        return yield* Effect.fail(apiError)
      }

      // Refresh current user to update identities list
      get.refresh(currentUserAtom)
    })
)

// =============================================================================
// Re-exports for convenience
// =============================================================================

export type { AuthUserResponse, ProviderMetadata, LoginResponse, AuthorizeRedirectResponse }
