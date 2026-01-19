import { describe, it, expect } from "@effect/vitest"
import { Effect, Equal, Exit, Redacted } from "effect"
import * as Schema from "effect/Schema"
import {
  LocalAuthRequest,
  isLocalAuthRequest,
  OAuthAuthRequest,
  isOAuthAuthRequest,
  SAMLAuthRequest,
  isSAMLAuthRequest,
  WorkOSAuthRequest,
  isWorkOSAuthRequest,
  AuthRequestSchema
} from "../../src/authentication/AuthRequest.ts"
import { Email } from "../../src/authentication/Email.ts"

describe("AuthRequest", () => {
  const validEmail = Email.make("test@example.com")
  const validPassword = Redacted.make("securePassword123")

  describe("LocalAuthRequest", () => {
    it("creates request with email and password", () => {
      const request = LocalAuthRequest.make({
        email: validEmail,
        password: validPassword
      })
      expect(request._tag).toBe("LocalAuthRequest")
      expect(request.email).toBe(validEmail)
      expect(Redacted.value(request.password)).toBe("securePassword123")
    })

    it("type guard works correctly", () => {
      const request = LocalAuthRequest.make({
        email: validEmail,
        password: validPassword
      })
      expect(isLocalAuthRequest(request)).toBe(true)
      expect(isLocalAuthRequest({ _tag: "LocalAuthRequest" })).toBe(false)
      expect(isLocalAuthRequest(null)).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const request = LocalAuthRequest.make({
          email: validEmail,
          password: validPassword
        })
        const encoded = yield* Schema.encode(LocalAuthRequest)(request)
        const decoded = yield* Schema.decodeUnknown(LocalAuthRequest)(encoded)
        expect(decoded._tag).toBe(request._tag)
        expect(decoded.email).toBe(request.email)
        // Redacted values are equal if they contain the same value
        expect(Redacted.value(decoded.password)).toBe(Redacted.value(request.password))
      })
    )

    it.effect("rejects invalid email", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(LocalAuthRequest)({
            _tag: "LocalAuthRequest",
            email: "not-an-email",
            password: "password123"
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects short password", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(LocalAuthRequest)({
            _tag: "LocalAuthRequest",
            email: "test@example.com",
            password: "short"
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("OAuthAuthRequest", () => {
    it("creates request with code and state", () => {
      const request = OAuthAuthRequest.make({
        code: "auth-code-123",
        state: "csrf-state-token"
      })
      expect(request._tag).toBe("OAuthAuthRequest")
      expect(request.code).toBe("auth-code-123")
      expect(request.state).toBe("csrf-state-token")
    })

    it("creates request with optional redirectUri", () => {
      const request = OAuthAuthRequest.make({
        code: "auth-code-123",
        state: "csrf-state-token",
        redirectUri: "https://example.com/callback"
      })
      expect(request.redirectUri).toBe("https://example.com/callback")
    })

    it("type guard works correctly", () => {
      const request = OAuthAuthRequest.make({
        code: "code",
        state: "state"
      })
      expect(isOAuthAuthRequest(request)).toBe(true)
      expect(isOAuthAuthRequest({ _tag: "OAuthAuthRequest" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const request = OAuthAuthRequest.make({
          code: "auth-code-123",
          state: "csrf-state"
        })
        const encoded = yield* Schema.encode(OAuthAuthRequest)(request)
        const decoded = yield* Schema.decodeUnknown(OAuthAuthRequest)(encoded)
        expect(Equal.equals(request, decoded)).toBe(true)
      })
    )

    it.effect("rejects empty code", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(OAuthAuthRequest)({
            _tag: "OAuthAuthRequest",
            code: "",
            state: "valid-state"
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("SAMLAuthRequest", () => {
    it("creates request with SAML response", () => {
      const request = SAMLAuthRequest.make({
        samlResponse: "base64-encoded-saml-response"
      })
      expect(request._tag).toBe("SAMLAuthRequest")
      expect(request.samlResponse).toBe("base64-encoded-saml-response")
    })

    it("creates request with optional relayState", () => {
      const request = SAMLAuthRequest.make({
        samlResponse: "base64-encoded-saml-response",
        relayState: "/dashboard"
      })
      expect(request.relayState).toBe("/dashboard")
    })

    it("type guard works correctly", () => {
      const request = SAMLAuthRequest.make({
        samlResponse: "response"
      })
      expect(isSAMLAuthRequest(request)).toBe(true)
      expect(isSAMLAuthRequest({ _tag: "SAMLAuthRequest" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const request = SAMLAuthRequest.make({
          samlResponse: "saml-response",
          relayState: "/home"
        })
        const encoded = yield* Schema.encode(SAMLAuthRequest)(request)
        const decoded = yield* Schema.decodeUnknown(SAMLAuthRequest)(encoded)
        expect(Equal.equals(request, decoded)).toBe(true)
      })
    )
  })

  describe("WorkOSAuthRequest", () => {
    it("creates request with code and state", () => {
      const request = WorkOSAuthRequest.make({
        code: "workos-auth-code",
        state: "workos-state"
      })
      expect(request._tag).toBe("WorkOSAuthRequest")
      expect(request.code).toBe("workos-auth-code")
      expect(request.state).toBe("workos-state")
    })

    it("type guard works correctly", () => {
      const request = WorkOSAuthRequest.make({
        code: "code",
        state: "state"
      })
      expect(isWorkOSAuthRequest(request)).toBe(true)
      expect(isWorkOSAuthRequest({ _tag: "WorkOSAuthRequest" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const request = WorkOSAuthRequest.make({
          code: "workos-code",
          state: "workos-state"
        })
        const encoded = yield* Schema.encode(WorkOSAuthRequest)(request)
        const decoded = yield* Schema.decodeUnknown(WorkOSAuthRequest)(encoded)
        expect(Equal.equals(request, decoded)).toBe(true)
      })
    )
  })

  describe("AuthRequestSchema (union)", () => {
    it.effect("decodes LocalAuthRequest", () =>
      Effect.gen(function* () {
        const encoded = {
          _tag: "LocalAuthRequest",
          email: "test@example.com",
          password: "password123"
        }
        const decoded = yield* Schema.decodeUnknown(AuthRequestSchema)(encoded)
        expect(decoded._tag).toBe("LocalAuthRequest")
        expect(isLocalAuthRequest(decoded)).toBe(true)
      })
    )

    it.effect("decodes OAuthAuthRequest", () =>
      Effect.gen(function* () {
        const encoded = {
          _tag: "OAuthAuthRequest",
          code: "auth-code",
          state: "csrf-state"
        }
        const decoded = yield* Schema.decodeUnknown(AuthRequestSchema)(encoded)
        expect(decoded._tag).toBe("OAuthAuthRequest")
        expect(isOAuthAuthRequest(decoded)).toBe(true)
      })
    )

    it.effect("decodes SAMLAuthRequest", () =>
      Effect.gen(function* () {
        const encoded = {
          _tag: "SAMLAuthRequest",
          samlResponse: "saml-data"
        }
        const decoded = yield* Schema.decodeUnknown(AuthRequestSchema)(encoded)
        expect(decoded._tag).toBe("SAMLAuthRequest")
        expect(isSAMLAuthRequest(decoded)).toBe(true)
      })
    )

    it.effect("decodes WorkOSAuthRequest", () =>
      Effect.gen(function* () {
        const encoded = {
          _tag: "WorkOSAuthRequest",
          code: "workos-code",
          state: "workos-state"
        }
        const decoded = yield* Schema.decodeUnknown(AuthRequestSchema)(encoded)
        expect(decoded._tag).toBe("WorkOSAuthRequest")
        expect(isWorkOSAuthRequest(decoded)).toBe(true)
      })
    )

    it.effect("rejects unknown tag", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(AuthRequestSchema)({
            _tag: "UnknownAuthRequest",
            foo: "bar"
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("structural equality", () => {
    it("LocalAuthRequest instances with same values are equal", () => {
      const request1 = LocalAuthRequest.make({
        email: validEmail,
        password: validPassword
      })
      const request2 = LocalAuthRequest.make({
        email: validEmail,
        password: validPassword
      })
      expect(Equal.equals(request1, request2)).toBe(true)
    })

    it("OAuthAuthRequest instances with same values are equal", () => {
      const request1 = OAuthAuthRequest.make({
        code: "code-123",
        state: "state-456"
      })
      const request2 = OAuthAuthRequest.make({
        code: "code-123",
        state: "state-456"
      })
      expect(Equal.equals(request1, request2)).toBe(true)
    })

    it("different request types are not equal", () => {
      const local = LocalAuthRequest.make({
        email: validEmail,
        password: validPassword
      })
      const oauth = OAuthAuthRequest.make({
        code: "code",
        state: "state"
      })
      expect(Equal.equals(local, oauth)).toBe(false)
    })
  })
})
