import { describe, it, expect } from "@effect/vitest"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import {
  AuthConfig,
  type AuthConfigData,
  authConfig,
  authConfigDefaults,
  localAuthDefaults,
  LocalAuthConfig,
  WorkOSAuthConfig,
  GoogleAuthConfig,
  GitHubAuthConfig,
  SAMLAuthConfig,
  makeAuthConfig,
  isProviderEnabled,
  isProviderAvailable,
  getProviderConfig,
  getLocalConfig,
  getGoogleConfig
} from "../../src/authentication/AuthConfig.ts"

describe("AuthConfig", () => {
  describe("LocalAuthConfig", () => {
    it("creates with valid defaults", () => {
      const config = LocalAuthConfig.make({
        requireEmailVerification: false,
        minPasswordLength: 8,
        requireUppercase: false,
        requireNumbers: false,
        requireSpecialChars: false
      })

      expect(config.requireEmailVerification).toBe(false)
      expect(config.minPasswordLength).toBe(8)
      expect(config.requireUppercase).toBe(false)
      expect(config.requireNumbers).toBe(false)
      expect(config.requireSpecialChars).toBe(false)
    })

    it("creates with custom values", () => {
      const config = LocalAuthConfig.make({
        requireEmailVerification: true,
        minPasswordLength: 12,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      })

      expect(config.requireEmailVerification).toBe(true)
      expect(config.minPasswordLength).toBe(12)
      expect(config.requireUppercase).toBe(true)
      expect(config.requireNumbers).toBe(true)
      expect(config.requireSpecialChars).toBe(true)
    })
  })

  describe("WorkOSAuthConfig", () => {
    it("creates with required fields", () => {
      const config = WorkOSAuthConfig.make({
        apiKey: Redacted.make("sk_test_123"),
        clientId: "client_123",
        redirectUri: "https://example.com/callback",
        organizationId: Option.none(),
        connectionId: Option.none()
      })

      expect(config.clientId).toBe("client_123")
      expect(config.redirectUri).toBe("https://example.com/callback")
      expect(Redacted.value(config.apiKey)).toBe("sk_test_123")
      expect(Option.isNone(config.organizationId)).toBe(true)
      expect(Option.isNone(config.connectionId)).toBe(true)
    })

    it("creates with optional organization and connection IDs", () => {
      const config = WorkOSAuthConfig.make({
        apiKey: Redacted.make("sk_test_123"),
        clientId: "client_123",
        redirectUri: "https://example.com/callback",
        organizationId: Option.some("org_123"),
        connectionId: Option.some("conn_123")
      })

      expect(Option.isSome(config.organizationId)).toBe(true)
      expect(Option.getOrElse(config.organizationId, () => "")).toBe("org_123")
      expect(Option.isSome(config.connectionId)).toBe(true)
      expect(Option.getOrElse(config.connectionId, () => "")).toBe("conn_123")
    })
  })

  describe("GoogleAuthConfig", () => {
    it("creates with valid values", () => {
      const config = GoogleAuthConfig.make({
        clientId: "google_client_123",
        clientSecret: Redacted.make("google_secret"),
        redirectUri: "https://example.com/google/callback"
      })

      expect(config.clientId).toBe("google_client_123")
      expect(Redacted.value(config.clientSecret)).toBe("google_secret")
      expect(config.redirectUri).toBe("https://example.com/google/callback")
    })
  })

  describe("GitHubAuthConfig", () => {
    it("creates with valid values", () => {
      const config = GitHubAuthConfig.make({
        clientId: "github_client_123",
        clientSecret: Redacted.make("github_secret"),
        redirectUri: "https://example.com/github/callback"
      })

      expect(config.clientId).toBe("github_client_123")
      expect(Redacted.value(config.clientSecret)).toBe("github_secret")
      expect(config.redirectUri).toBe("https://example.com/github/callback")
    })
  })

  describe("SAMLAuthConfig", () => {
    it("creates with valid values", () => {
      const config = SAMLAuthConfig.make({
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificate: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
        spEntityId: "https://app.example.com",
        spAcsUrl: "https://app.example.com/saml/acs"
      })

      expect(config.idpEntityId).toBe("https://idp.example.com")
      expect(config.idpSsoUrl).toBe("https://idp.example.com/sso")
      expect(config.spEntityId).toBe("https://app.example.com")
      expect(config.spAcsUrl).toBe("https://app.example.com/saml/acs")
    })
  })

  describe("defaults", () => {
    it("localAuthDefaults has expected values", () => {
      expect(localAuthDefaults.requireEmailVerification).toBe(false)
      expect(localAuthDefaults.minPasswordLength).toBe(8)
      expect(localAuthDefaults.requireUppercase).toBe(false)
      expect(localAuthDefaults.requireNumbers).toBe(false)
      expect(localAuthDefaults.requireSpecialChars).toBe(false)
    })

    it("authConfigDefaults has expected values", () => {
      expect(authConfigDefaults.enabledProviders).toEqual(["local"])
      expect(authConfigDefaults.defaultRole).toBe("member")
      expect(Duration.toMillis(authConfigDefaults.sessionDuration)).toBe(
        Duration.toMillis(Duration.hours(24))
      )
      expect(authConfigDefaults.autoLinkByEmail).toBe(true)
      expect(authConfigDefaults.requireEmailVerification).toBe(false)
    })
  })

  describe("authConfig from environment", () => {
    it.effect("loads defaults when no environment variables are set", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(new Map())
        )

        expect(config.enabledProviders).toEqual(["local"])
        expect(config.defaultRole).toBe("member")
        expect(config.autoLinkByEmail).toBe(true)
        expect(config.requireEmailVerification).toBe(false)
        expect(Option.isSome(config.providerConfigs.local)).toBe(true)
      })
    )

    it.effect("loads custom enabled providers", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(
            new Map([["AUTH_ENABLED_PROVIDERS", "local,google,workos"]])
          )
        )

        expect(config.enabledProviders).toContain("local")
        expect(config.enabledProviders).toContain("google")
        expect(config.enabledProviders).toContain("workos")
        expect(config.enabledProviders).toHaveLength(3)
      })
    )

    it.effect("filters invalid providers from enabled list", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(
            new Map([["AUTH_ENABLED_PROVIDERS", "local,invalid,google,unknown"]])
          )
        )

        expect(config.enabledProviders).toContain("local")
        expect(config.enabledProviders).toContain("google")
        expect(config.enabledProviders).toHaveLength(2)
      })
    )

    it.effect("loads custom default role", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(new Map([["AUTH_DEFAULT_ROLE", "admin"]]))
        )

        expect(config.defaultRole).toBe("admin")
      })
    )

    it.effect("falls back to member for invalid role", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(new Map([["AUTH_DEFAULT_ROLE", "superadmin"]]))
        )

        expect(config.defaultRole).toBe("member")
      })
    )

    it.effect("loads custom session duration", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(new Map([["AUTH_SESSION_DURATION", "7 days"]]))
        )

        expect(Duration.toMillis(config.sessionDuration)).toBe(
          Duration.toMillis(Duration.days(7))
        )
      })
    )

    it.effect("loads auto link by email setting", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(new Map([["AUTH_AUTO_LINK_BY_EMAIL", "false"]]))
        )

        expect(config.autoLinkByEmail).toBe(false)
      })
    )

    it.effect("loads email verification requirement", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(
            new Map([["AUTH_REQUIRE_EMAIL_VERIFICATION", "true"]])
          )
        )

        expect(config.requireEmailVerification).toBe(true)
      })
    )

    it.effect("loads Google config when environment variables are set", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(
            new Map([
              ["AUTH_GOOGLE.CLIENT_ID", "google_client_123"],
              ["AUTH_GOOGLE.CLIENT_SECRET", "google_secret_456"],
              ["AUTH_GOOGLE.REDIRECT_URI", "https://example.com/google/callback"]
            ])
          )
        )

        expect(Option.isSome(config.providerConfigs.google)).toBe(true)
        const googleConfig = Option.getOrThrow(config.providerConfigs.google)
        expect(googleConfig.clientId).toBe("google_client_123")
        expect(Redacted.value(googleConfig.clientSecret)).toBe("google_secret_456")
        expect(googleConfig.redirectUri).toBe("https://example.com/google/callback")
      })
    )

    it.effect("returns None for Google config when not configured", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(new Map())
        )

        expect(Option.isNone(config.providerConfigs.google)).toBe(true)
      })
    )

    it.effect("loads WorkOS config when environment variables are set", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(
            new Map([
              ["AUTH_WORKOS.API_KEY", "sk_test_123"],
              ["AUTH_WORKOS.CLIENT_ID", "client_123"],
              ["AUTH_WORKOS.REDIRECT_URI", "https://example.com/workos/callback"],
              ["AUTH_WORKOS.ORGANIZATION_ID", "org_123"]
            ])
          )
        )

        expect(Option.isSome(config.providerConfigs.workos)).toBe(true)
        const workosConfig = Option.getOrThrow(config.providerConfigs.workos)
        expect(workosConfig.clientId).toBe("client_123")
        expect(Redacted.value(workosConfig.apiKey)).toBe("sk_test_123")
        expect(workosConfig.redirectUri).toBe("https://example.com/workos/callback")
        expect(Option.getOrElse(workosConfig.organizationId, () => "")).toBe("org_123")
      })
    )

    it.effect("loads local auth config with nested variables", () =>
      Effect.gen(function* () {
        const config = yield* Effect.withConfigProvider(
          authConfig,
          ConfigProvider.fromMap(
            new Map([
              ["AUTH_LOCAL.REQUIRE_EMAIL_VERIFICATION", "true"],
              ["AUTH_LOCAL.MIN_PASSWORD_LENGTH", "12"],
              ["AUTH_LOCAL.REQUIRE_UPPERCASE", "true"],
              ["AUTH_LOCAL.REQUIRE_NUMBERS", "true"],
              ["AUTH_LOCAL.REQUIRE_SPECIAL_CHARS", "true"]
            ])
          )
        )

        expect(Option.isSome(config.providerConfigs.local)).toBe(true)
        const localConfig = Option.getOrThrow(config.providerConfigs.local)
        expect(localConfig.requireEmailVerification).toBe(true)
        expect(localConfig.minPasswordLength).toBe(12)
        expect(localConfig.requireUppercase).toBe(true)
        expect(localConfig.requireNumbers).toBe(true)
        expect(localConfig.requireSpecialChars).toBe(true)
      })
    )
  })

  describe("makeAuthConfig", () => {
    it.effect("creates a layer with specified config", () =>
      Effect.gen(function* () {
        const testConfig: AuthConfigData = {
          enabledProviders: ["local", "google"],
          defaultRole: "admin",
          sessionDuration: Duration.days(7),
          autoLinkByEmail: false,
          requireEmailVerification: true,
          providerConfigs: {
            local: Option.some(localAuthDefaults),
            workos: Option.none(),
            google: Option.none(),
            github: Option.none(),
            saml: Option.none()
          }
        }

        const config = yield* AuthConfig.pipe(Effect.provide(makeAuthConfig(testConfig)))

        expect(config.enabledProviders).toEqual(["local", "google"])
        expect(config.defaultRole).toBe("admin")
        expect(config.autoLinkByEmail).toBe(false)
        expect(config.requireEmailVerification).toBe(true)
      })
    )
  })

  describe("helper functions", () => {
    const testConfig: AuthConfigData = {
      enabledProviders: ["local", "google"],
      defaultRole: "member",
      sessionDuration: Duration.hours(24),
      autoLinkByEmail: true,
      requireEmailVerification: false,
      providerConfigs: {
        local: Option.some(localAuthDefaults),
        workos: Option.none(),
        google: Option.some(
          GoogleAuthConfig.make({
            clientId: "test",
            clientSecret: Redacted.make("secret"),
            redirectUri: "https://example.com/callback"
          })
        ),
        github: Option.none(),
        saml: Option.none()
      }
    }

    describe("isProviderEnabled", () => {
      it("returns true for enabled providers", () => {
        expect(isProviderEnabled(testConfig, "local")).toBe(true)
        expect(isProviderEnabled(testConfig, "google")).toBe(true)
      })

      it("returns false for disabled providers", () => {
        expect(isProviderEnabled(testConfig, "workos")).toBe(false)
        expect(isProviderEnabled(testConfig, "github")).toBe(false)
        expect(isProviderEnabled(testConfig, "saml")).toBe(false)
      })
    })

    describe("getProviderConfig", () => {
      it("returns Some for configured providers", () => {
        expect(Option.isSome(getProviderConfig(testConfig, "local"))).toBe(true)
        expect(Option.isSome(getProviderConfig(testConfig, "google"))).toBe(true)
      })

      it("returns None for unconfigured providers", () => {
        expect(Option.isNone(getProviderConfig(testConfig, "workos"))).toBe(true)
        expect(Option.isNone(getProviderConfig(testConfig, "github"))).toBe(true)
        expect(Option.isNone(getProviderConfig(testConfig, "saml"))).toBe(true)
      })

      it("returns correct config for local provider", () => {
        const config = getLocalConfig(testConfig)
        expect(Option.isSome(config)).toBe(true)
        const localConfig = Option.getOrThrow(config)
        expect(localConfig.minPasswordLength).toBe(8)
      })

      it("returns correct config for google provider", () => {
        const config = getGoogleConfig(testConfig)
        expect(Option.isSome(config)).toBe(true)
        const googleConfig = Option.getOrThrow(config)
        expect(googleConfig.clientId).toBe("test")
      })
    })

    describe("isProviderAvailable", () => {
      it("returns true when provider is both enabled and configured", () => {
        expect(isProviderAvailable(testConfig, "local")).toBe(true)
        expect(isProviderAvailable(testConfig, "google")).toBe(true)
      })

      it("returns false when provider is enabled but not configured", () => {
        const configWithEnabledWorkos: AuthConfigData = {
          ...testConfig,
          enabledProviders: ["local", "google", "workos"]
        }
        expect(isProviderAvailable(configWithEnabledWorkos, "workos")).toBe(false)
      })

      it("returns false when provider is configured but not enabled", () => {
        const configWithDisabledGoogle: AuthConfigData = {
          ...testConfig,
          enabledProviders: ["local"]
        }
        expect(isProviderAvailable(configWithDisabledGoogle, "google")).toBe(false)
      })

      it("returns false when provider is neither enabled nor configured", () => {
        expect(isProviderAvailable(testConfig, "saml")).toBe(false)
      })
    })
  })
})
