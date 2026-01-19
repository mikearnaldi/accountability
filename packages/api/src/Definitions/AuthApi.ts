/**
 * AuthApi - HTTP API group for authentication
 *
 * Provides endpoints for:
 * - Provider discovery (public)
 * - User registration with local provider (public)
 * - Login with any enabled provider (public)
 * - OAuth/SAML authorization flows (public)
 * - Logout and session management (protected)
 * - Provider identity linking (protected)
 *
 * @module AuthApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { AuthProviderType } from "@accountability/core/authentication/AuthProviderType"
import { AuthUser } from "@accountability/core/authentication/AuthUser"
import { Email } from "@accountability/core/authentication/Email"
import { SessionId } from "@accountability/core/authentication/SessionId"
import { UserIdentity, UserIdentityId } from "@accountability/core/authentication/UserIdentity"
import { AuthMiddleware } from "./AuthMiddleware.ts"

// =============================================================================
// Auth-Specific Error Schemas (with HTTP status codes)
// =============================================================================

/**
 * AuthValidationError - Request validation failed (400)
 */
export class AuthValidationError extends Schema.TaggedError<AuthValidationError>()(
  "AuthValidationError",
  {
    message: Schema.String.annotations({
      description: "A human-readable description of the validation error"
    }),
    field: Schema.OptionFromNullOr(Schema.String).annotations({
      description: "The field that failed validation, if applicable"
    })
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/**
 * PasswordWeakError - Password does not meet requirements (400)
 */
export class PasswordWeakError extends Schema.TaggedError<PasswordWeakError>()(
  "PasswordWeakError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "Password does not meet requirements")
    ),
    requirements: Schema.Array(Schema.String).annotations({
      description: "List of password requirements that were not met"
    })
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/**
 * OAuthStateInvalidError - OAuth state mismatch (400)
 */
export class OAuthStateInvalidError extends Schema.TaggedError<OAuthStateInvalidError>()(
  "OAuthStateInvalidError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "OAuth state mismatch. Please restart the authentication flow.")
    ),
    provider: AuthProviderType
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/**
 * AuthUnauthorizedError - Authentication required or invalid credentials (401)
 */
export class AuthUnauthorizedError extends Schema.TaggedError<AuthUnauthorizedError>()(
  "AuthUnauthorizedError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "Invalid credentials or authentication required")
    )
  },
  HttpApiSchema.annotations({ status: 401 })
) {}

/**
 * ProviderAuthError - External provider authentication failed (401)
 */
export class ProviderAuthError extends Schema.TaggedError<ProviderAuthError>()(
  "ProviderAuthError",
  {
    provider: AuthProviderType,
    reason: Schema.String.annotations({
      description: "A description of why the authentication failed"
    })
  },
  HttpApiSchema.annotations({ status: 401 })
) {
  get message(): string {
    return `Authentication with ${this.provider} failed: ${this.reason}`
  }
}

/**
 * SessionInvalidError - Session expired or not found (401)
 */
export class SessionInvalidError extends Schema.TaggedError<SessionInvalidError>()(
  "SessionInvalidError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "Session is invalid or expired")
    )
  },
  HttpApiSchema.annotations({ status: 401 })
) {}

/**
 * ProviderNotFoundError - Auth provider not enabled (404)
 */
export class ProviderNotFoundError extends Schema.TaggedError<ProviderNotFoundError>()(
  "ProviderNotFoundError",
  {
    provider: AuthProviderType,
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "Authentication provider not found or not enabled")
    )
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/**
 * UserNotFoundError - User does not exist (404)
 */
export class AuthUserNotFoundError extends Schema.TaggedError<AuthUserNotFoundError>()(
  "AuthUserNotFoundError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "User not found")
    )
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/**
 * IdentityNotFoundError - Identity does not exist (404)
 */
export class IdentityNotFoundError extends Schema.TaggedError<IdentityNotFoundError>()(
  "IdentityNotFoundError",
  {
    identityId: UserIdentityId,
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "Identity not found")
    )
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/**
 * UserExistsError - Email already registered (409)
 */
export class UserExistsError extends Schema.TaggedError<UserExistsError>()(
  "UserExistsError",
  {
    email: Email,
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "A user with this email already exists")
    )
  },
  HttpApiSchema.annotations({ status: 409 })
) {}

/**
 * IdentityAlreadyLinkedError - Provider identity already linked to another user (409)
 */
export class IdentityLinkedError extends Schema.TaggedError<IdentityLinkedError>()(
  "IdentityLinkedError",
  {
    provider: AuthProviderType,
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "This identity is already linked to another account")
    )
  },
  HttpApiSchema.annotations({ status: 409 })
) {}

/**
 * CannotUnlinkLastIdentityError - Cannot remove the last identity (409)
 */
export class CannotUnlinkLastIdentityError extends Schema.TaggedError<CannotUnlinkLastIdentityError>()(
  "CannotUnlinkLastIdentityError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "Cannot unlink the last identity. User must have at least one linked provider.")
    )
  },
  HttpApiSchema.annotations({ status: 409 })
) {}

// =============================================================================
// Request/Response Schemas
// =============================================================================

/**
 * ProviderMetadata - Information about an enabled auth provider
 */
export class ProviderMetadata extends Schema.Class<ProviderMetadata>("ProviderMetadata")({
  type: AuthProviderType,
  name: Schema.String.annotations({
    description: "Display name for the provider"
  }),
  supportsRegistration: Schema.Boolean.annotations({
    description: "Whether this provider supports user registration"
  }),
  supportsPasswordLogin: Schema.Boolean.annotations({
    description: "Whether this provider uses password-based authentication"
  }),
  oauthEnabled: Schema.Boolean.annotations({
    description: "Whether this provider uses OAuth/SAML flow"
  })
}) {}

/**
 * ProvidersResponse - List of enabled authentication providers
 */
export class ProvidersResponse extends Schema.Class<ProvidersResponse>("ProvidersResponse")({
  providers: Schema.Array(ProviderMetadata)
}) {}

/**
 * RegisterRequest - Request body for local user registration
 */
export class RegisterRequest extends Schema.Class<RegisterRequest>("RegisterRequest")({
  email: Email,
  password: Schema.String.pipe(
    Schema.minLength(8),
    Schema.annotations({
      description: "User's password (min 8 characters)"
    })
  ),
  displayName: Schema.NonEmptyTrimmedString.annotations({
    description: "User's display name"
  })
}) {}

/**
 * LocalLoginCredentials - Credentials for local provider login
 */
export class LocalLoginCredentials extends Schema.Class<LocalLoginCredentials>("LocalLoginCredentials")({
  email: Email,
  password: Schema.String.annotations({
    description: "User's password"
  })
}) {}

/**
 * OAuthLoginCredentials - Credentials for OAuth provider login (authorization code)
 */
export class OAuthLoginCredentials extends Schema.Class<OAuthLoginCredentials>("OAuthLoginCredentials")({
  code: Schema.String.annotations({
    description: "Authorization code from OAuth provider"
  }),
  state: Schema.String.annotations({
    description: "State parameter for CSRF validation"
  })
}) {}

/**
 * LoginRequest - Request body for login
 *
 * The credentials field varies based on provider:
 * - local: LocalLoginCredentials (email/password)
 * - oauth providers: OAuthLoginCredentials (code/state)
 */
export class LoginRequest extends Schema.Class<LoginRequest>("LoginRequest")({
  provider: AuthProviderType,
  credentials: Schema.Union(LocalLoginCredentials, OAuthLoginCredentials)
}) {}

/**
 * LoginResponse - Successful login response
 */
export class LoginResponse extends Schema.Class<LoginResponse>("LoginResponse")({
  token: SessionId.annotations({
    description: "Session token to use for authenticated requests"
  }),
  user: AuthUser,
  provider: AuthProviderType.annotations({
    description: "The provider used for authentication"
  }),
  expiresAt: Schema.DateTimeUtc.annotations({
    description: "When the session expires"
  })
}) {}

/**
 * AuthUserResponse - Response containing user details with linked identities
 */
export class AuthUserResponse extends Schema.Class<AuthUserResponse>("AuthUserResponse")({
  user: AuthUser,
  identities: Schema.Array(UserIdentity).annotations({
    description: "All linked authentication provider identities"
  })
}) {}

/**
 * RefreshResponse - Response from session refresh
 */
export class RefreshResponse extends Schema.Class<RefreshResponse>("RefreshResponse")({
  token: SessionId.annotations({
    description: "New session token"
  }),
  expiresAt: Schema.DateTimeUtc.annotations({
    description: "When the new session expires"
  })
}) {}

/**
 * UpdateProfileRequest - Request body for updating user profile
 */
export class UpdateProfileRequest extends Schema.Class<UpdateProfileRequest>("UpdateProfileRequest")({
  displayName: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    description: "The user's display name (optional - only provided fields are updated)"
  })
}) {}

/**
 * OAuthCallbackParams - Query parameters for OAuth callback
 */
export const OAuthCallbackParams = Schema.Struct({
  code: Schema.String.annotations({
    description: "Authorization code from OAuth provider"
  }),
  state: Schema.String.annotations({
    description: "State parameter for CSRF validation"
  }),
  error: Schema.optional(Schema.String).annotations({
    description: "Error code if authorization failed"
  }),
  error_description: Schema.optional(Schema.String).annotations({
    description: "Human-readable error description"
  })
})

/**
 * Type for OAuthCallbackParams
 */
export type OAuthCallbackParams = typeof OAuthCallbackParams.Type

/**
 * AuthorizeRedirectResponse - Response for authorize endpoint (redirect URL)
 */
export class AuthorizeRedirectResponse extends Schema.Class<AuthorizeRedirectResponse>("AuthorizeRedirectResponse")({
  redirectUrl: Schema.String.annotations({
    description: "URL to redirect the user to for OAuth authorization"
  }),
  state: Schema.String.annotations({
    description: "State parameter for CSRF validation"
  })
}) {}

/**
 * LinkInitiateResponse - Response when initiating provider linking
 */
export class LinkInitiateResponse extends Schema.Class<LinkInitiateResponse>("LinkInitiateResponse")({
  redirectUrl: Schema.String.annotations({
    description: "URL to redirect the user to for OAuth authorization"
  }),
  state: Schema.String.annotations({
    description: "State parameter for CSRF validation"
  })
}) {}

// =============================================================================
// Public API Endpoints
// =============================================================================

/**
 * GET /api/auth/providers - List enabled authentication providers
 */
const getProviders = HttpApiEndpoint.get("getProviders", "/providers")
  .addSuccess(ProvidersResponse)
  .annotateContext(OpenApi.annotations({
    summary: "List authentication providers",
    description: "Returns a list of enabled authentication providers with their metadata"
  }))

/**
 * POST /api/auth/register - Register a new user (local provider only)
 */
const register = HttpApiEndpoint.post("register", "/register")
  .setPayload(RegisterRequest)
  .addSuccess(AuthUserResponse, { status: 201 })
  .addError(AuthValidationError)
  .addError(PasswordWeakError)
  .addError(UserExistsError)
  .annotateContext(OpenApi.annotations({
    summary: "Register new user",
    description: "Create a new user account with local email/password authentication"
  }))

/**
 * POST /api/auth/login - Login with any provider
 */
const login = HttpApiEndpoint.post("login", "/login")
  .setPayload(LoginRequest)
  .addSuccess(LoginResponse)
  .addError(AuthValidationError)
  .addError(AuthUnauthorizedError)
  .addError(ProviderAuthError)
  .addError(ProviderNotFoundError)
  .addError(OAuthStateInvalidError)
  .annotateContext(OpenApi.annotations({
    summary: "Login",
    description: "Authenticate with any enabled provider. For local provider, provide email/password. For OAuth providers, provide authorization code and state."
  }))

/**
 * GET /api/auth/authorize/:provider - Get OAuth authorization URL
 */
const authorize = HttpApiEndpoint.get("authorize", "/authorize/:provider")
  .setPath(Schema.Struct({ provider: AuthProviderType }))
  .addSuccess(AuthorizeRedirectResponse)
  .addError(ProviderNotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Get authorization URL",
    description: "Get the OAuth/SAML authorization URL for the specified provider. Redirect the user to this URL to initiate the OAuth flow."
  }))

/**
 * GET /api/auth/callback/:provider - Handle OAuth callback
 */
const callback = HttpApiEndpoint.get("callback", "/callback/:provider")
  .setPath(Schema.Struct({ provider: AuthProviderType }))
  .setUrlParams(OAuthCallbackParams)
  .addSuccess(LoginResponse)
  .addError(ProviderNotFoundError)
  .addError(ProviderAuthError)
  .addError(OAuthStateInvalidError)
  .annotateContext(OpenApi.annotations({
    summary: "OAuth callback",
    description: "Handle the OAuth/SAML callback from the provider. Exchanges the authorization code for tokens and creates a session."
  }))

// =============================================================================
// Protected API Endpoints
// =============================================================================

/**
 * LogoutResponse - Successful logout response
 */
export class LogoutResponse extends Schema.Class<LogoutResponse>("LogoutResponse")({
  success: Schema.Boolean.annotations({
    description: "Whether the logout was successful"
  })
}) {}

/**
 * POST /api/auth/logout - Logout and invalidate session
 */
const logout = HttpApiEndpoint.post("logout", "/logout")
  .addSuccess(LogoutResponse)
  .addError(SessionInvalidError)
  .annotateContext(OpenApi.annotations({
    summary: "Logout",
    description: "Invalidate the current session and logout the user"
  }))

/**
 * GET /api/auth/me - Get current user details
 */
const me = HttpApiEndpoint.get("me", "/me")
  .addSuccess(AuthUserResponse)
  .addError(AuthUserNotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Get current user",
    description: "Get the authenticated user's details including all linked provider identities"
  }))

/**
 * PUT /api/auth/me - Update current user profile
 */
const updateMe = HttpApiEndpoint.put("updateMe", "/me")
  .setPayload(UpdateProfileRequest)
  .addSuccess(AuthUserResponse)
  .addError(AuthValidationError)
  .addError(AuthUserNotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Update current user profile",
    description: "Update the authenticated user's profile information (display name)"
  }))

/**
 * POST /api/auth/refresh - Refresh session token
 */
const refresh = HttpApiEndpoint.post("refresh", "/refresh")
  .addSuccess(RefreshResponse)
  .addError(SessionInvalidError)
  .annotateContext(OpenApi.annotations({
    summary: "Refresh session",
    description: "Refresh the current session and get a new token with extended expiration"
  }))

/**
 * POST /api/auth/link/:provider - Initiate linking additional provider
 */
const linkProvider = HttpApiEndpoint.post("linkProvider", "/link/:provider")
  .setPath(Schema.Struct({ provider: AuthProviderType }))
  .addSuccess(LinkInitiateResponse)
  .addError(ProviderNotFoundError)
  .addError(IdentityLinkedError)
  .annotateContext(OpenApi.annotations({
    summary: "Link provider",
    description: "Initiate linking an additional authentication provider to the current user account. Returns an OAuth authorization URL."
  }))

/**
 * GET /api/auth/link/callback/:provider - Complete provider linking
 */
const linkCallback = HttpApiEndpoint.get("linkCallback", "/link/callback/:provider")
  .setPath(Schema.Struct({ provider: AuthProviderType }))
  .setUrlParams(OAuthCallbackParams)
  .addSuccess(AuthUserResponse)
  .addError(ProviderNotFoundError)
  .addError(ProviderAuthError)
  .addError(OAuthStateInvalidError)
  .addError(IdentityLinkedError)
  .annotateContext(OpenApi.annotations({
    summary: "Link provider callback",
    description: "Complete the provider linking flow after OAuth authorization. Links the provider identity to the current user account."
  }))

/**
 * DELETE /api/auth/identities/:identityId - Unlink provider from account
 */
const unlinkIdentity = HttpApiEndpoint.del("unlinkIdentity", "/identities/:identityId")
  .setPath(Schema.Struct({ identityId: UserIdentityId }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(IdentityNotFoundError)
  .addError(CannotUnlinkLastIdentityError)
  .annotateContext(OpenApi.annotations({
    summary: "Unlink identity",
    description: "Remove a linked provider identity from the current user account. Users must maintain at least one linked identity."
  }))

/**
 * ChangePasswordRequest - Request body for changing password
 */
export class ChangePasswordRequest extends Schema.Class<ChangePasswordRequest>("ChangePasswordRequest")({
  currentPassword: Schema.String.annotations({
    description: "The user's current password for verification"
  }),
  newPassword: Schema.String.pipe(
    Schema.minLength(8),
    Schema.annotations({
      description: "The new password (min 8 characters)"
    })
  )
}) {}

/**
 * ChangePasswordError - Current password is incorrect (401)
 */
export class ChangePasswordError extends Schema.TaggedError<ChangePasswordError>()(
  "ChangePasswordError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "Current password is incorrect")
    )
  },
  HttpApiSchema.annotations({ status: 401 })
) {}

/**
 * NoLocalIdentityError - User has no local provider linked (400)
 */
export class NoLocalIdentityError extends Schema.TaggedError<NoLocalIdentityError>()(
  "NoLocalIdentityError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "No local identity linked. Password change is only available for accounts with local authentication.")
    )
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/**
 * POST /api/auth/change-password - Change user's password
 */
const changePassword = HttpApiEndpoint.post("changePassword", "/change-password")
  .setPayload(ChangePasswordRequest)
  .addSuccess(HttpApiSchema.NoContent)
  .addError(ChangePasswordError)
  .addError(NoLocalIdentityError)
  .addError(PasswordWeakError)
  .annotateContext(OpenApi.annotations({
    summary: "Change password",
    description: "Change the current user's password. Requires the current password for verification. Only available for users with local authentication."
  }))

// =============================================================================
// API Groups
// =============================================================================

/**
 * AuthPublicApi - Public authentication endpoints (no auth required)
 */
export class AuthPublicApi extends HttpApiGroup.make("authPublic")
  .add(getProviders)
  .add(register)
  .add(login)
  .add(authorize)
  .add(callback)
  .annotateContext(OpenApi.annotations({
    title: "Authentication (Public)",
    description: "Public authentication endpoints for provider discovery, registration, and login"
  })) {}

/**
 * AuthProtectedApi - Protected authentication endpoints (auth required)
 */
export class AuthProtectedApi extends HttpApiGroup.make("authProtected")
  .add(logout)
  .add(me)
  .add(refresh)
  .add(linkProvider)
  .add(linkCallback)
  .add(unlinkIdentity)
  .middleware(AuthMiddleware)
  .annotateContext(OpenApi.annotations({
    title: "Authentication (Protected)",
    description: "Protected authentication endpoints for session management and identity linking"
  })) {}

/**
 * AuthApi - Public authentication API group
 *
 * Base path: /api/auth
 *
 * Public endpoints (no authentication required):
 * - GET /providers - List enabled providers
 * - POST /register - Register new user
 * - POST /login - Login
 * - GET /authorize/:provider - Get OAuth authorization URL
 * - GET /callback/:provider - OAuth callback
 */
export class AuthApi extends HttpApiGroup.make("auth")
  .add(getProviders)
  .add(register)
  .add(login)
  .add(authorize)
  .add(callback)
  .prefix("/auth")
  .annotateContext(OpenApi.annotations({
    title: "Authentication",
    description: "Public authentication endpoints for provider discovery, registration, and login"
  })) {}

/**
 * AuthSessionApi - Protected authentication API group
 *
 * Base path: /api/auth
 *
 * Protected endpoints (require authentication):
 * - POST /logout - Logout
 * - GET /me - Get current user
 * - PUT /me - Update current user profile
 * - POST /refresh - Refresh session
 * - POST /link/:provider - Initiate provider linking
 * - GET /link/callback/:provider - Complete provider linking
 * - DELETE /identities/:identityId - Unlink provider
 * - POST /change-password - Change password
 */
export class AuthSessionApi extends HttpApiGroup.make("authSession")
  .add(logout)
  .add(me)
  .add(updateMe)
  .add(refresh)
  .add(linkProvider)
  .add(linkCallback)
  .add(unlinkIdentity)
  .add(changePassword)
  .middleware(AuthMiddleware)
  .prefix("/auth")
  .annotateContext(OpenApi.annotations({
    title: "Authentication (Session)",
    description: "Protected authentication endpoints for session management and identity linking"
  })) {}
