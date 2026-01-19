import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  UserIdentity,
  isUserIdentity,
  UserIdentityId,
  isUserIdentityId,
  ProviderData
} from "../../src/authentication/UserIdentity.ts"
import { AuthUserId } from "../../src/authentication/AuthUserId.ts"
import { ProviderId } from "../../src/authentication/ProviderId.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

describe("UserIdentityId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = UserIdentityId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(UserIdentityId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isUserIdentityId returns true for valid UserIdentityId", () => {
      expect(isUserIdentityId(validUUID)).toBe(true)
    })

    it("isUserIdentityId returns false for invalid values", () => {
      expect(isUserIdentityId("not-a-uuid")).toBe(false)
      expect(isUserIdentityId(null)).toBe(false)
    })
  })
})

describe("ProviderData", () => {
  describe("validation", () => {
    it.effect("accepts empty provider data", () =>
      Effect.gen(function* () {
        const data = yield* Schema.decodeUnknown(ProviderData)({})
        expect(data.profile).toBeUndefined()
        expect(data.metadata).toBeUndefined()
      })
    )

    it.effect("accepts provider data with profile", () =>
      Effect.gen(function* () {
        const data = yield* Schema.decodeUnknown(ProviderData)({
          profile: { name: "Test User", picture: "https://example.com/pic.jpg" }
        })
        expect(data.profile).toEqual({ name: "Test User", picture: "https://example.com/pic.jpg" })
      })
    )

    it.effect("accepts provider data with metadata", () =>
      Effect.gen(function* () {
        const data = yield* Schema.decodeUnknown(ProviderData)({
          metadata: { lastLogin: "2024-01-01", tokenExpiry: 3600 }
        })
        expect(data.metadata).toEqual({ lastLogin: "2024-01-01", tokenExpiry: 3600 })
      })
    )

    it.effect("accepts provider data with both fields", () =>
      Effect.gen(function* () {
        const data = yield* Schema.decodeUnknown(ProviderData)({
          profile: { id: "123" },
          metadata: { key: "value" }
        })
        expect(data.profile).toEqual({ id: "123" })
        expect(data.metadata).toEqual({ key: "value" })
      })
    )
  })
})

describe("UserIdentity", () => {
  const identityId = "550e8400-e29b-41d4-a716-446655440000"
  const userId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  const createValidUserIdentity = () =>
    UserIdentity.make({
      id: UserIdentityId.make(identityId),
      userId: AuthUserId.make(userId),
      provider: "google",
      providerId: ProviderId.make("116789012345678901234"),
      providerData: Option.none(),
      createdAt: Timestamp.make({ epochMillis: 1718409600000 })
    })

  describe("validation", () => {
    it.effect("accepts valid UserIdentity without provider data", () =>
      Effect.gen(function* () {
        const identity = createValidUserIdentity()
        expect(identity.id).toBe(identityId)
        expect(identity.userId).toBe(userId)
        expect(identity.provider).toBe("google")
        expect(identity.providerId).toBe("116789012345678901234")
        expect(Option.isNone(identity.providerData)).toBe(true)
      })
    )

    it.effect("accepts valid UserIdentity with provider data", () =>
      Effect.gen(function* () {
        const identity = UserIdentity.make({
          id: UserIdentityId.make(identityId),
          userId: AuthUserId.make(userId),
          provider: "workos",
          providerId: ProviderId.make("user_01HCZN4YRBD1W7NW5RMW9PMY3Z"),
          providerData: Option.some({
            profile: { email: "user@company.com", organization: "Acme Inc" },
            metadata: { ssoMethod: "saml" }
          }),
          createdAt: Timestamp.make({ epochMillis: 1718409600000 })
        })
        expect(Option.isSome(identity.providerData)).toBe(true)
        if (Option.isSome(identity.providerData)) {
          expect(identity.providerData.value.profile).toEqual({
            email: "user@company.com",
            organization: "Acme Inc"
          })
        }
      })
    )

    it.effect("accepts different provider types", () =>
      Effect.gen(function* () {
        const localIdentity = UserIdentity.make({
          id: UserIdentityId.make(identityId),
          userId: AuthUserId.make(userId),
          provider: "local",
          providerId: ProviderId.make("user@example.com"),
          providerData: Option.none(),
          createdAt: Timestamp.make({ epochMillis: 1718409600000 })
        })
        expect(localIdentity.provider).toBe("local")

        const githubIdentity = UserIdentity.make({
          id: UserIdentityId.make("7c7b8d90-1234-5678-9abc-def012345678"),
          userId: AuthUserId.make(userId),
          provider: "github",
          providerId: ProviderId.make("12345678"),
          providerData: Option.none(),
          createdAt: Timestamp.make({ epochMillis: 1718409600000 })
        })
        expect(githubIdentity.provider).toBe("github")
      })
    )

    it.effect("rejects invalid provider", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(UserIdentity)
        const result = yield* Effect.exit(decode({
          id: identityId,
          userId,
          provider: "facebook",
          providerId: "123456",
          providerData: { _tag: "None" },
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty provider ID", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(UserIdentity)
        const result = yield* Effect.exit(decode({
          id: identityId,
          userId,
          provider: "google",
          providerId: "",
          providerData: { _tag: "None" },
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isUserIdentity returns true for UserIdentity instances", () => {
      const identity = createValidUserIdentity()
      expect(isUserIdentity(identity)).toBe(true)
    })

    it("isUserIdentity returns false for plain objects", () => {
      expect(isUserIdentity({
        id: identityId,
        userId,
        provider: "google",
        providerId: "123456"
      })).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for UserIdentity", () => {
      const identity1 = createValidUserIdentity()
      const identity2 = UserIdentity.make({
        id: UserIdentityId.make(identityId),
        userId: AuthUserId.make(userId),
        provider: "google",
        providerId: ProviderId.make("116789012345678901234"),
        providerData: Option.none(),
        createdAt: Timestamp.make({ epochMillis: 1718409600000 })
      })
      const identity3 = UserIdentity.make({
        id: UserIdentityId.make("7c7b8d90-1234-5678-9abc-def012345678"),
        userId: AuthUserId.make(userId),
        provider: "github",
        providerId: ProviderId.make("different-id"),
        providerData: Option.none(),
        createdAt: Timestamp.make({ epochMillis: 1718409600000 })
      })

      expect(Equal.equals(identity1, identity2)).toBe(true)
      expect(Equal.equals(identity1, identity3)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes UserIdentity without provider data", () =>
      Effect.gen(function* () {
        const original = createValidUserIdentity()
        const encoded = yield* Schema.encode(UserIdentity)(original)
        const decoded = yield* Schema.decodeUnknown(UserIdentity)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes UserIdentity with provider data", () =>
      Effect.gen(function* () {
        const original = UserIdentity.make({
          id: UserIdentityId.make(identityId),
          userId: AuthUserId.make(userId),
          provider: "google",
          providerId: ProviderId.make("116789012345678901234"),
          providerData: Option.some({
            profile: { name: "Test" },
            metadata: { key: "value" }
          }),
          createdAt: Timestamp.make({ epochMillis: 1718409600000 })
        })
        const encoded = yield* Schema.encode(UserIdentity)(original)
        const decoded = yield* Schema.decodeUnknown(UserIdentity)(encoded)

        // Compare fields individually since Unknown fields don't have structural equality
        expect(decoded.id).toBe(original.id)
        expect(decoded.userId).toBe(original.userId)
        expect(decoded.provider).toBe(original.provider)
        expect(decoded.providerId).toBe(original.providerId)
        expect(Option.isSome(decoded.providerData)).toBe(true)
        if (Option.isSome(decoded.providerData) && Option.isSome(original.providerData)) {
          expect(decoded.providerData.value.profile).toEqual(original.providerData.value.profile)
          expect(decoded.providerData.value.metadata).toEqual(original.providerData.value.metadata)
        }
      })
    )
  })
})
