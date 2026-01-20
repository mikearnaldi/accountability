# Authentication System

This document describes the multi-provider authentication system for the Accountability application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Provider Types](#provider-types)
3. [Configuration Guide](#configuration-guide)
4. [Local Provider Setup](#local-provider-setup)
5. [Google OAuth Setup](#google-oauth-setup)
6. [WorkOS Integration](#workos-integration)
7. [Implementing a New Provider](#implementing-a-new-provider)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The authentication system uses a **multi-provider strategy pattern** that allows users to authenticate via multiple methods while maintaining a unified identity.

### Core Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                            AuthService                               │
│  (Orchestrates authentication, session management, identity linking) │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Local      │       │   Google     │       │   WorkOS     │
│  Provider    │       │  Provider    │       │  Provider    │
│(email/pass)  │       │  (OAuth2)    │       │   (SSO)      │
└──────────────┘       └──────────────┘       └──────────────┘
```

### Package Structure

| Package | Path | Purpose |
|---------|------|---------|
| **core** | `packages/core/src/Auth/` | Domain types, errors, service interfaces |
| **persistence** | `packages/persistence/src/` | Provider implementations, repositories |
| **api** | `packages/api/src/` | HTTP endpoints, middleware |
| **web** | `packages/web/src/` | React UI, state management |

### Key Types

| Type | Location | Description |
|------|----------|-------------|
| `AuthService` | `core/Auth/AuthService.ts` | Main service interface |
| `AuthProvider` | `core/Auth/AuthProvider.ts` | Strategy interface for providers |
| `AuthConfig` | `core/Auth/AuthConfig.ts` | Configuration system |
| `Session` | `core/Auth/Session.ts` | User session entity |
| `UserIdentity` | `core/Auth/UserIdentity.ts` | Links users to provider identities |
| `AuthUser` | `core/Auth/AuthUser.ts` | Authenticated user entity |

### Authentication Flow

**Local Authentication (email/password):**
```
1. User submits email + password
2. LocalAuthProvider verifies credentials
3. AuthService creates session
4. Session token returned to client
```

**OAuth Authentication (Google, GitHub):**
```
1. Client requests authorization URL
2. User redirects to provider
3. Provider authenticates user
4. Provider redirects back with code
5. handleOAuthCallback exchanges code for tokens
6. AuthService creates/links user and session
7. Session token returned to client
```

**SSO Authentication (WorkOS, SAML):**
```
1. Client requests authorization URL
2. User redirects to WorkOS/IdP
3. Enterprise IdP authenticates user
4. WorkOS redirects back with code
5. handleOAuthCallback exchanges code for profile
6. AuthService creates/links user and session
7. Session token returned to client
```

### Identity Linking

Users can link multiple authentication providers to a single account:

- **Automatic linking**: When `autoLinkByEmail` is enabled, authenticating with a new provider automatically links to an existing user with the same email
- **Manual linking**: Users can explicitly link additional providers via `/api/auth/link/:provider`
- **Unlinking**: Users can remove linked identities (must keep at least one)

---

## Provider Types

The system supports five provider types:

| Provider | Type | Use Case | Registration |
|----------|------|----------|--------------|
| **local** | Email/password | Self-service apps | Supported |
| **google** | OAuth 2.0 | Consumer apps | Auto-provision |
| **github** | OAuth 2.0 | Developer apps | Auto-provision |
| **workos** | SSO | Enterprise apps | Auto-provision |
| **saml** | SAML 2.0 | Enterprise apps | Auto-provision |

### Provider Selection

Enable providers based on your use case:

- **SaaS product for consumers**: `local,google`
- **Developer tools**: `local,github,google`
- **Enterprise SaaS**: `local,workos`
- **Self-hosted enterprise**: `local,saml`
- **Maximum flexibility**: `local,google,github,workos`

---

## Configuration Guide

### Environment Variables

#### Global Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AUTH_ENABLED_PROVIDERS` | string | `"local"` | Comma-separated list of enabled providers |
| `AUTH_DEFAULT_ROLE` | string | `"member"` | Default role for new users (`admin`, `owner`, `member`, `viewer`) |
| `AUTH_SESSION_DURATION` | duration | `"24 hours"` | Default session duration |
| `AUTH_AUTO_LINK_BY_EMAIL` | boolean | `true` | Auto-link identities by email match |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | boolean | `false` | Require email verification (local) |

#### Local Provider Settings

All prefixed with `AUTH_LOCAL_`:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AUTH_LOCAL_REQUIRE_EMAIL_VERIFICATION` | boolean | `false` | Require email verification |
| `AUTH_LOCAL_MIN_PASSWORD_LENGTH` | integer | `8` | Minimum password length |
| `AUTH_LOCAL_REQUIRE_UPPERCASE` | boolean | `false` | Require uppercase in password |
| `AUTH_LOCAL_REQUIRE_NUMBERS` | boolean | `false` | Require numbers in password |
| `AUTH_LOCAL_REQUIRE_SPECIAL_CHARS` | boolean | `false` | Require special characters |

#### Google OAuth Settings

All prefixed with `AUTH_GOOGLE_`:

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `AUTH_GOOGLE_CLIENT_ID` | string | Yes | OAuth client ID from Google Cloud Console |
| `AUTH_GOOGLE_CLIENT_SECRET` | string | Yes | OAuth client secret |
| `AUTH_GOOGLE_REDIRECT_URI` | string | Yes | Callback URL (e.g., `https://app.example.com/api/auth/callback/google`) |

#### GitHub OAuth Settings

All prefixed with `AUTH_GITHUB_`:

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `AUTH_GITHUB_CLIENT_ID` | string | Yes | OAuth client ID |
| `AUTH_GITHUB_CLIENT_SECRET` | string | Yes | OAuth client secret |
| `AUTH_GITHUB_REDIRECT_URI` | string | Yes | Callback URL |

#### WorkOS SSO Settings

All prefixed with `AUTH_WORKOS_`:

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `AUTH_WORKOS_API_KEY` | string | Yes | WorkOS API key (starts with `sk_`) |
| `AUTH_WORKOS_CLIENT_ID` | string | Yes | WorkOS client ID (starts with `client_`) |
| `AUTH_WORKOS_REDIRECT_URI` | string | Yes | Callback URL |
| `AUTH_WORKOS_ORGANIZATION_ID` | string | No | Default organization for SSO routing |
| `AUTH_WORKOS_CONNECTION_ID` | string | No | Direct SSO connection ID |

#### SAML Settings

All prefixed with `AUTH_SAML_`:

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `AUTH_SAML_IDP_ENTITY_ID` | string | Yes | IdP Entity ID |
| `AUTH_SAML_IDP_SSO_URL` | string | Yes | IdP Single Sign-On URL |
| `AUTH_SAML_IDP_CERTIFICATE` | string | Yes | IdP X.509 certificate (PEM format) |
| `AUTH_SAML_SP_ENTITY_ID` | string | Yes | Your app's Entity ID |
| `AUTH_SAML_SP_ACS_URL` | string | Yes | Assertion Consumer Service URL |

### Session Duration per Provider

Default session durations are configured in `AuthServiceConfig`:

| Provider | Default Duration | Rationale |
|----------|-----------------|-----------|
| local | 7 days | Users expect to stay logged in |
| google | 24 hours | Consumer OAuth standard |
| github | 24 hours | Consumer OAuth standard |
| workos | 8 hours | Enterprise workday session |
| saml | 8 hours | Enterprise workday session |

To customize, modify `SessionDurationConfig` in your application layer.

### Example Configuration

```bash
# .env file for a SaaS with Google OAuth and enterprise WorkOS

# Enable providers
AUTH_ENABLED_PROVIDERS=local,google,workos

# Global settings
AUTH_DEFAULT_ROLE=member
AUTH_SESSION_DURATION=24 hours
AUTH_AUTO_LINK_BY_EMAIL=true

# Local provider
AUTH_LOCAL_MIN_PASSWORD_LENGTH=12
AUTH_LOCAL_REQUIRE_UPPERCASE=true
AUTH_LOCAL_REQUIRE_NUMBERS=true

# Google OAuth
AUTH_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
AUTH_GOOGLE_CLIENT_SECRET=GOCSPX-abc123
AUTH_GOOGLE_REDIRECT_URI=https://app.example.com/api/auth/callback/google

# WorkOS SSO
AUTH_WORKOS_API_KEY=sk_live_abc123
AUTH_WORKOS_CLIENT_ID=client_abc123
AUTH_WORKOS_REDIRECT_URI=https://app.example.com/api/auth/callback/workos
```

---

## Local Provider Setup

The local provider handles traditional email/password authentication.

### 1. Enable the Provider

```bash
AUTH_ENABLED_PROVIDERS=local
```

### 2. Configure Password Requirements

```bash
# Recommended for production
AUTH_LOCAL_MIN_PASSWORD_LENGTH=12
AUTH_LOCAL_REQUIRE_UPPERCASE=true
AUTH_LOCAL_REQUIRE_NUMBERS=true
AUTH_LOCAL_REQUIRE_SPECIAL_CHARS=true
```

### 3. Registration Flow

Users register via `POST /api/auth/register`:

```typescript
// Request
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd!",
  "displayName": "John Doe"
}

// Response (201 Created)
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "role": "member",
    "primaryProvider": "local"
  },
  "identities": [...]
}
```

### 4. Login Flow

Users login via `POST /api/auth/login`:

```typescript
// Request
{
  "provider": "local",
  "credentials": {
    "email": "user@example.com",
    "password": "SecureP@ssw0rd!"
  }
}

// Response
{
  "token": "session_token_here",
  "user": { ... },
  "provider": "local",
  "expiresAt": "2024-01-15T12:00:00Z"
}
```

### Password Storage

Passwords are hashed using the `PasswordHasher` service with secure defaults:

- Passwords stored as argon2id hashes
- Salt automatically generated and included in hash
- Original password never stored

---

## Google OAuth Setup

### 1. Create OAuth Credentials in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** > **Credentials**
3. Click **Create Credentials** > **OAuth client ID**
4. Select **Web application**
5. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
6. Copy the Client ID and Client Secret

### 2. Configure Environment Variables

```bash
AUTH_ENABLED_PROVIDERS=local,google

AUTH_GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
AUTH_GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
AUTH_GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/callback/google
```

### 3. OAuth Flow

The OAuth flow uses these endpoints:

1. **Get Authorization URL**: `GET /api/auth/authorize/google`
   ```json
   {
     "redirectUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
     "state": "csrf_protection_token"
   }
   ```

2. **Handle Callback**: `GET /api/auth/callback/google?code=...&state=...`
   - Exchanges code for tokens
   - Fetches user profile from Google
   - Creates/links user account
   - Returns session token

### Google OAuth Scopes

The provider requests these scopes:
- `openid` - OpenID Connect
- `email` - User's email address
- `profile` - User's profile info (name, picture)

### User Data Retrieved

From Google's userinfo endpoint:
- `id` - Google user ID (used as provider ID)
- `email` - Email address
- `verified_email` - Email verification status
- `name` - Display name
- `given_name` / `family_name` - Name parts
- `picture` - Profile picture URL

---

## WorkOS Integration

WorkOS provides enterprise SSO, supporting multiple identity providers (Okta, Azure AD, OneLogin, etc.).

### 1. Create WorkOS Account and Organization

1. Sign up at [WorkOS Dashboard](https://dashboard.workos.com)
2. Create an organization
3. Configure SSO connection(s) for your customers' IdPs
4. Get your API key and Client ID

### 2. Configure Environment Variables

```bash
AUTH_ENABLED_PROVIDERS=local,workos

AUTH_WORKOS_API_KEY=sk_live_xxxxxxxxxxxx
AUTH_WORKOS_CLIENT_ID=client_xxxxxxxxxxxx
AUTH_WORKOS_REDIRECT_URI=https://yourdomain.com/api/auth/callback/workos

# Optional: Default organization for SSO routing
AUTH_WORKOS_ORGANIZATION_ID=org_xxxxxxxxxxxx

# Optional: Direct connection (bypasses org selection)
AUTH_WORKOS_CONNECTION_ID=conn_xxxxxxxxxxxx
```

### 3. SSO Flow

1. **Initiate SSO**: `GET /api/auth/authorize/workos`
   - Returns WorkOS authorization URL
   - User redirects to their company's IdP

2. **Handle Callback**: `GET /api/auth/callback/workos?code=...&state=...`
   - WorkOS validates the SSO assertion
   - Returns user profile
   - Creates/links user account

### WorkOS Connection Types

WorkOS supports these connection types:
- SAML (Okta, Azure AD, OneLogin, etc.)
- OIDC (OpenID Connect)
- Google Workspace
- Microsoft Azure AD

### User Data Retrieved

From WorkOS profile:
- `id` - WorkOS profile ID (used as provider ID)
- `email` - User's email
- `first_name` / `last_name` - Name
- `connection_id` - The SSO connection used
- `connection_type` - Type of connection (SAML, OIDC, etc.)
- `organization_id` - WorkOS organization ID
- `idp_id` - ID from the identity provider
- `raw_attributes` - Full IdP attributes (for custom claims)

### Multi-Tenant SSO

For B2B applications with multiple customers:

1. Each customer creates their own WorkOS organization
2. Configure organization-specific SSO connections
3. Use domain-based routing or organization selection UI
4. Pass `organization` parameter to authorization URL

---

## Implementing a New Provider

Follow these steps to add a new authentication provider.

### Step 1: Add Provider Type

In `packages/core/src/Auth/AuthProviderType.ts`, add the new type:

```typescript
// Add to the literal union
export const AuthProviderType = Schema.Literal(
  "local",
  "workos",
  "google",
  "github",
  "saml",
  "myNewProvider"  // Add here
)
```

### Step 2: Create Provider Configuration Schema

In `packages/core/src/Auth/AuthConfig.ts`:

```typescript
export class MyNewProviderConfig extends Schema.Class<MyNewProviderConfig>(
  "MyNewProviderConfig"
)({
  clientId: Schema.NonEmptyTrimmedString,
  clientSecret: Schema.Redacted(Schema.NonEmptyTrimmedString),
  redirectUri: Schema.NonEmptyTrimmedString,
  // Add provider-specific config fields
}) {}
```

Add to `ProviderConfigs` interface and config loader.

### Step 3: Create Provider Service Tag

In `packages/persistence/src/Services/`:

```typescript
// MyNewAuthProvider.ts
import * as Context from "effect/Context"
import type { AuthProvider } from "@accountability/core/Auth/AuthProvider"

export class MyNewAuthProvider extends Context.Tag("MyNewAuthProvider")<
  MyNewAuthProvider,
  AuthProvider
>() {}
```

### Step 4: Implement Provider

In `packages/persistence/src/Layers/MyNewAuthProviderLive.ts`:

```typescript
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { HttpClient, HttpClientRequest } from "@effect/platform"
import type { AuthProvider } from "@accountability/core/Auth/AuthProvider"
import { ProviderId } from "@accountability/core/Auth/ProviderId"
import { Email } from "@accountability/core/Auth/Email"
import { AuthResult } from "@accountability/core/Auth/AuthResult"
import { ProviderAuthFailedError } from "@accountability/core/Auth/AuthErrors"
import { MyNewAuthProvider } from "../Services/MyNewAuthProvider.ts"
import { MyNewConfigTag } from "../Services/MyNewConfig.ts"

const make = Effect.gen(function* () {
  const config = yield* MyNewConfigTag
  const httpClient = yield* HttpClient.HttpClient

  const provider: AuthProvider = {
    type: "myNewProvider",

    supportsRegistration: false,  // OAuth providers typically don't

    authenticate: () =>
      Effect.fail(
        new ProviderAuthFailedError({
          provider: "myNewProvider",
          reason: "Use OAuth flow instead"
        })
      ),

    getAuthorizationUrl: (state: string, redirectUri?: string) => {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri ?? config.redirectUri,
        response_type: "code",
        state,
        // Add provider-specific params
      })
      return Option.some(`https://provider.com/oauth/authorize?${params}`)
    },

    handleCallback: (code: string, _state: string) =>
      Effect.gen(function* () {
        // 1. Exchange code for tokens
        const tokenResponse = yield* exchangeCodeForTokens(code)

        // 2. Fetch user profile
        const profile = yield* fetchUserProfile(tokenResponse.access_token)

        // 3. Map to AuthResult
        return AuthResult.make({
          provider: "myNewProvider",
          providerId: ProviderId.make(profile.id),
          email: Email.make(profile.email),
          displayName: profile.name,
          emailVerified: profile.email_verified,
          providerData: Option.some({
            profile: { /* provider-specific data */ }
          })
        })
      })
  }

  return provider
})

export const MyNewAuthProviderLive = Layer.effect(MyNewAuthProvider, make)
```

### Step 5: Update Database Migrations

If needed, update the `auth_provider_type` enum:

```typescript
// Migration to add new provider type
yield* sql`
  ALTER TYPE auth_provider_type ADD VALUE 'myNewProvider'
`
```

### Step 6: Register Provider

Update the layer composition to include the new provider in the provider registry.

### Step 7: Add Frontend Support

1. Add provider button in login page
2. Handle OAuth redirect flow
3. Add provider icon/branding

### Provider Interface Reference

```typescript
interface AuthProvider {
  // Provider type identifier
  readonly type: AuthProviderType

  // Whether this provider supports direct registration
  readonly supportsRegistration: boolean

  // Authenticate with credentials (local) or fail (OAuth)
  readonly authenticate: (
    request: AuthRequest
  ) => Effect.Effect<AuthResult, InvalidCredentialsError | ProviderAuthFailedError>

  // Get OAuth authorization URL (returns None for local)
  readonly getAuthorizationUrl: (
    state: string,
    redirectUri?: string
  ) => Option.Option<string>

  // Handle OAuth callback and exchange code for profile
  readonly handleCallback: (
    code: string,
    state: string
  ) => Effect.Effect<AuthResult, ProviderAuthFailedError | OAuthStateError>
}
```

---

## Security Considerations

### CSRF Protection

**State Parameter**: All OAuth flows use a `state` parameter for CSRF protection:

1. Server generates cryptographically random state
2. State included in authorization URL
3. State returned in callback
4. Server validates state matches before processing

```typescript
// State generation (AuthServiceLive.ts:382-386)
const stateBytes = new Uint8Array(32)
crypto.getRandomValues(stateBytes)
const state = btoa(String.fromCharCode(...stateBytes))
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "")
```

### Session Management

**Session Tokens**:
- Generated using cryptographically secure random bytes
- Stored server-side in PostgreSQL
- Transmitted via httpOnly secure cookies (never localStorage)
- Protected from XSS via httpOnly flag, CSRF via sameSite strict

**Session Expiration**:
- Sessions have provider-specific durations
- Expired sessions are automatically invalidated
- Users can manually logout to invalidate sessions

**Session Security**:
```sql
-- Session table includes security metadata
CREATE TABLE auth_sessions (
  id VARCHAR(255) PRIMARY KEY,    -- Secure random token
  user_id UUID NOT NULL,
  provider auth_provider_type,
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent VARCHAR(1024),       -- For audit
  ip_address VARCHAR(45)          -- For audit
)
```

### Token Storage (Client-Side)

**IMPORTANT: Session tokens MUST be stored in httpOnly secure cookies. localStorage usage is FORBIDDEN.**

The session token is set by the server as an httpOnly cookie:

```typescript
// Server sets cookie on successful authentication
HttpServerResponse.setCookie("session", token, {
  httpOnly: true,      // Not accessible via JavaScript - prevents XSS theft
  secure: true,        // Only sent over HTTPS
  sameSite: "strict",  // CSRF protection
  path: "/",           // Available for all routes
  maxAge: "7 days"     // Session duration
})

// Cookie automatically cleared on logout
HttpServerResponse.setCookie("session", "", {
  httpOnly: true,
  secure: true,
  maxAge: "0 seconds"  // Immediate expiration
})
```

**Why httpOnly cookies are required**:
- **XSS Protection**: httpOnly cookies cannot be accessed by JavaScript, so even if an attacker injects malicious scripts, they cannot steal the session token
- **Automatic transmission**: Browser automatically sends cookies with requests, no client-side token management needed
- **CSRF protection**: Combined with `sameSite: "strict"`, cookies are not sent with cross-site requests

**Why localStorage is forbidden**:
- **XSS vulnerability**: Any XSS attack can read localStorage and exfiltrate tokens
- **No expiration control**: localStorage has no built-in expiration mechanism
- **Cross-tab leakage**: Malicious scripts in any tab can access localStorage
- **Persistence risk**: localStorage survives browser restarts, increasing exposure window

### Password Security

**Storage**:
- Passwords hashed with secure algorithm (argon2id recommended)
- Salt automatically included
- Original password never stored or logged

**Requirements**:
- Minimum 8 characters (configurable)
- Optional: uppercase, numbers, special characters
- Validation happens server-side

**Error Messages**:
- Generic "Invalid email or password" for failed logins
- Does not reveal whether email exists

### Identity Linking Security

**Automatic Linking by Email**:
- Only link if provider confirms email is verified
- Configurable via `AUTH_AUTO_LINK_BY_EMAIL`
- Consider disabling for high-security apps

**Manual Linking**:
- Requires active session (authenticated user)
- Cannot link identity already linked to another user
- Cannot unlink last identity (prevents account lockout)

### API Security

**Authentication Middleware**:
```typescript
// Bearer token authentication
class AuthMiddleware extends HttpApiMiddleware.Tag("AuthMiddleware", {
  failure: UnauthorizedError,
  provides: CurrentUser,
  security: { bearer: HttpApiSecurity.bearer }
}) {}
```

**Protected Endpoints**:
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/auth/link/:provider`
- `DELETE /api/auth/identities/:id`

### Secrets Management

**Environment Variables**:
- Never commit secrets to version control
- Use secret management services (AWS Secrets Manager, Vault)
- Rotate secrets periodically

**Redacted Types**:
```typescript
// Secrets use Schema.Redacted to prevent accidental logging
clientSecret: Schema.Redacted(Schema.NonEmptyTrimmedString)
```

---

## Troubleshooting

### Common Issues

#### "Provider not enabled" Error

**Cause**: Provider not in `AUTH_ENABLED_PROVIDERS`

**Solution**:
```bash
# Add the provider to enabled list
AUTH_ENABLED_PROVIDERS=local,google
```

#### "Invalid credentials" for Local Auth

**Causes**:
1. Wrong email or password
2. User doesn't exist
3. No local identity for user (only OAuth)

**Debug Steps**:
1. Check user exists in `auth_users` table
2. Check identity exists in `auth_identities` with `provider='local'`
3. Verify password hash is set

#### OAuth Callback Errors

**"State mismatch" / OAuthStateError**:
- Cause: CSRF protection triggered
- Possible reasons:
  - Session expired during OAuth flow
  - User navigated away and came back
  - Multiple tabs interfering
- Solution: Restart OAuth flow from the beginning

**"Token exchange failed"**:
- Cause: Provider rejected authorization code
- Possible reasons:
  - Code already used (codes are single-use)
  - Code expired (typically 10 minutes)
  - Wrong redirect URI
- Solution: Check `AUTH_*_REDIRECT_URI` matches exactly

**"Invalid client"**:
- Cause: Wrong client ID or secret
- Solution: Verify credentials in provider dashboard

#### Session Issues

**"Session not found"**:
- Session was logged out or expired
- Solution: Re-authenticate

**"Session expired"**:
- Session duration exceeded
- Solution: Configure longer duration or use refresh

#### Database Errors

**"Column 'auth_provider_type' doesn't exist"**:
- Migrations not run
- Solution: Run database migrations

**"Duplicate key violation on auth_identities"**:
- Identity already linked
- Solution: Check if already linked, unlink first if needed

### Debugging Tips

#### Enable Effect Logging

```typescript
import { Logger, LogLevel } from "effect"

// Add to your layer composition
Logger.minimumLogLevel(LogLevel.Debug)
```

#### Check Database State

```sql
-- List all users
SELECT * FROM auth_users;

-- List identities for a user
SELECT * FROM auth_identities WHERE user_id = 'user-id';

-- List active sessions
SELECT * FROM auth_sessions WHERE expires_at > NOW();

-- Clean up expired sessions
DELETE FROM auth_sessions WHERE expires_at < NOW();
```

#### Test OAuth Flow Manually

```bash
# 1. Get authorization URL
curl http://localhost:3000/api/auth/authorize/google

# 2. Follow the redirectUrl in browser

# 3. After callback, check response
# (callback handled automatically)
```

#### Verify Configuration

```typescript
import { AuthConfig, authConfigFromEnv } from "@accountability/core/Auth/AuthConfig"
import { Effect } from "effect"

// Print loaded config
Effect.runPromise(
  authConfigFromEnv.pipe(
    Effect.tap(config => Effect.log("Config:", config))
  )
)
```

### Error Reference

| Error | HTTP Status | Cause | Resolution |
|-------|-------------|-------|------------|
| `InvalidCredentialsError` | 401 | Wrong email/password | Check credentials |
| `SessionExpiredError` | 401 | Session expired | Re-authenticate |
| `SessionNotFoundError` | 401 | Invalid session token | Re-authenticate |
| `ProviderAuthFailedError` | 401 | OAuth/SSO failed | Check provider config |
| `ProviderNotEnabledError` | 404 | Provider not configured | Enable provider |
| `UserNotFoundError` | 404 | User doesn't exist | Register first |
| `UserAlreadyExistsError` | 409 | Email taken | Use different email |
| `IdentityAlreadyLinkedError` | 409 | Identity linked to other user | Unlink from other account |
| `PasswordTooWeakError` | 400 | Password requirements not met | Use stronger password |
| `OAuthStateError` | 400 | CSRF state mismatch | Restart OAuth flow |

---

## API Reference

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/providers` | List enabled providers |
| POST | `/api/auth/register` | Register with local provider |
| POST | `/api/auth/login` | Login with any provider |
| GET | `/api/auth/authorize/:provider` | Get OAuth authorization URL |
| GET | `/api/auth/callback/:provider` | Handle OAuth callback |

### Protected Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/logout` | Invalidate current session |
| GET | `/api/auth/me` | Get current user with identities |
| POST | `/api/auth/refresh` | Refresh session token |
| POST | `/api/auth/link/:provider` | Initiate provider linking |
| GET | `/api/auth/link/callback/:provider` | Complete provider linking |
| DELETE | `/api/auth/identities/:identityId` | Unlink provider identity |

---

## Database Schema

### auth_users

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | User's email (unique) |
| display_name | VARCHAR(255) | Display name |
| role | user_role | User role enum |
| primary_provider | auth_provider_type | Primary auth method |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### auth_identities

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth_users |
| provider | auth_provider_type | Provider type |
| provider_id | VARCHAR(255) | ID from provider |
| password_hash | VARCHAR(255) | Hash (local only) |
| provider_data | JSONB | Provider-specific data |
| created_at | TIMESTAMPTZ | Creation timestamp |

### auth_sessions

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(255) | Session token (primary key) |
| user_id | UUID | Foreign key to auth_users |
| provider | auth_provider_type | Auth provider used |
| expires_at | TIMESTAMPTZ | Expiration time |
| created_at | TIMESTAMPTZ | Creation timestamp |
| user_agent | VARCHAR(1024) | Client user agent |
| ip_address | VARCHAR(45) | Client IP address |
