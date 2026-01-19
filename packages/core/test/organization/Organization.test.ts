import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal } from "effect"
import * as Schema from "effect/Schema"
import {
  OrganizationId,
  isOrganizationId,
  OrganizationSettings,
  isOrganizationSettings,
  Organization,
  isOrganization
} from "../../src/organization/Organization.ts"
import { USD, EUR, GBP } from "../../src/currency/CurrencyCode.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

describe("OrganizationId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"
  const anotherValidUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = OrganizationId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("accepts another valid UUID format", () =>
      Effect.gen(function* () {
        const id = OrganizationId.make(anotherValidUUID)
        expect(id).toBe(anotherValidUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(OrganizationId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(OrganizationId)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects malformed UUIDs", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(OrganizationId)
        // Missing one character
        const result = yield* Effect.exit(decode("550e8400-e29b-41d4-a716-44665544000"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isOrganizationId returns true for valid OrganizationId", () => {
      const id = OrganizationId.make(validUUID)
      expect(isOrganizationId(id)).toBe(true)
    })

    it("isOrganizationId returns true for plain UUID string (validates pattern)", () => {
      // The type guard checks the UUID pattern, so any valid UUID string passes
      expect(isOrganizationId(validUUID)).toBe(true)
    })

    it("isOrganizationId returns false for non-string values", () => {
      expect(isOrganizationId(null)).toBe(false)
      expect(isOrganizationId(undefined)).toBe(false)
      expect(isOrganizationId(123)).toBe(false)
      expect(isOrganizationId({})).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates OrganizationId using Schema's .make()", () => {
      const id = OrganizationId.make(validUUID)
      expect(id).toBe(validUUID)
      expect(isOrganizationId(id)).toBe(true)
    })
  })
})

describe("OrganizationSettings", () => {
  describe("validation", () => {
    it.effect("accepts valid settings with all fields", () =>
      Effect.gen(function* () {
        const settings = OrganizationSettings.make({
          defaultLocale: "en-GB",
          defaultTimezone: "Europe/London",
          defaultDecimalPlaces: 3
        })
        expect(settings.defaultLocale).toBe("en-GB")
        expect(settings.defaultTimezone).toBe("Europe/London")
        expect(settings.defaultDecimalPlaces).toBe(3)
      })
    )

    it.effect("uses default values when not provided", () =>
      Effect.gen(function* () {
        const settings = OrganizationSettings.make({})
        expect(settings.defaultLocale).toBe("en-US")
        expect(settings.defaultTimezone).toBe("UTC")
        expect(settings.defaultDecimalPlaces).toBe(2)
      })
    )

    it.effect("rejects decimal places out of range (negative)", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(OrganizationSettings)
        const result = yield* Effect.exit(decode({ defaultDecimalPlaces: -1 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects decimal places out of range (too high)", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(OrganizationSettings)
        const result = yield* Effect.exit(decode({ defaultDecimalPlaces: 5 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-integer decimal places", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(OrganizationSettings)
        const result = yield* Effect.exit(decode({ defaultDecimalPlaces: 2.5 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isOrganizationSettings returns true for OrganizationSettings instances", () => {
      const settings = OrganizationSettings.make({})
      expect(isOrganizationSettings(settings)).toBe(true)
    })

    it("isOrganizationSettings returns false for plain objects", () => {
      expect(isOrganizationSettings({
        defaultLocale: "en-US",
        defaultTimezone: "UTC",
        defaultDecimalPlaces: 2
      })).toBe(false)
    })

    it("isOrganizationSettings returns false for non-object values", () => {
      expect(isOrganizationSettings(null)).toBe(false)
      expect(isOrganizationSettings(undefined)).toBe(false)
      expect(isOrganizationSettings("settings")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for OrganizationSettings", () => {
      const settings1 = OrganizationSettings.make({
        defaultLocale: "en-US",
        defaultTimezone: "UTC"
      })
      const settings2 = OrganizationSettings.make({
        defaultLocale: "en-US",
        defaultTimezone: "UTC"
      })
      const settings3 = OrganizationSettings.make({
        defaultLocale: "en-GB",
        defaultTimezone: "Europe/London"
      })

      expect(Equal.equals(settings1, settings2)).toBe(true)
      expect(Equal.equals(settings1, settings3)).toBe(false)
    })
  })
})

describe("Organization", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"
  const anotherValidUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  const createValidOrganization = () => {
    return Organization.make({
      id: OrganizationId.make(validUUID),
      name: "Acme Corporation",
      reportingCurrency: USD,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      settings: OrganizationSettings.make({})
    })
  }

  describe("validation", () => {
    it.effect("accepts valid organization data", () =>
      Effect.gen(function* () {
        const org = createValidOrganization()
        expect(org.id).toBe(validUUID)
        expect(org.name).toBe("Acme Corporation")
        expect(org.reportingCurrency).toBe(USD)
        expect(org.createdAt.epochMillis).toBe(1718409600000)
        expect(org.settings.defaultLocale).toBe("en-US")
      })
    )

    it.effect("accepts organization with different currencies", () =>
      Effect.gen(function* () {
        const eurOrg = Organization.make({
          id: OrganizationId.make(validUUID),
          name: "Euro Corp",
          reportingCurrency: EUR,
          createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
          settings: OrganizationSettings.make({})
        })
        expect(eurOrg.reportingCurrency).toBe(EUR)

        const gbpOrg = Organization.make({
          id: OrganizationId.make(anotherValidUUID),
          name: "British Corp",
          reportingCurrency: GBP,
          createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
          settings: OrganizationSettings.make({})
        })
        expect(gbpOrg.reportingCurrency).toBe(GBP)
      })
    )

    it.effect("accepts organization with custom settings", () =>
      Effect.gen(function* () {
        const org = Organization.make({
          id: OrganizationId.make(validUUID),
          name: "Custom Settings Corp",
          reportingCurrency: USD,
          createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
          settings: OrganizationSettings.make({
            defaultLocale: "en-GB",
            defaultTimezone: "Europe/London",
            defaultDecimalPlaces: 4
          })
        })
        expect(org.settings.defaultLocale).toBe("en-GB")
        expect(org.settings.defaultTimezone).toBe("Europe/London")
        expect(org.settings.defaultDecimalPlaces).toBe(4)
      })
    )

    it.effect("rejects empty name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Organization)
        const result = yield* Effect.exit(decode({
          id: validUUID,
          name: "",
          reportingCurrency: "USD",
          createdAt: { epochMillis: 1718409600000 },
          settings: {}
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects whitespace-only name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Organization)
        const result = yield* Effect.exit(decode({
          id: validUUID,
          name: "   ",
          reportingCurrency: "USD",
          createdAt: { epochMillis: 1718409600000 },
          settings: {}
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid currency code", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Organization)
        const result = yield* Effect.exit(decode({
          id: validUUID,
          name: "Test Corp",
          reportingCurrency: "INVALID",
          createdAt: { epochMillis: 1718409600000 },
          settings: {}
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid organization id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Organization)
        const result = yield* Effect.exit(decode({
          id: "not-a-uuid",
          name: "Test Corp",
          reportingCurrency: "USD",
          createdAt: { epochMillis: 1718409600000 },
          settings: {}
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects missing required fields", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Organization)
        const result = yield* Effect.exit(decode({
          id: validUUID
          // Missing name, reportingCurrency, createdAt, settings
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isOrganization returns true for Organization instances", () => {
      const org = createValidOrganization()
      expect(isOrganization(org)).toBe(true)
    })

    it("isOrganization returns false for plain objects", () => {
      expect(isOrganization({
        id: validUUID,
        name: "Test Corp",
        reportingCurrency: "USD",
        createdAt: { epochMillis: 1718409600000 },
        settings: {}
      })).toBe(false)
    })

    it("isOrganization returns false for non-object values", () => {
      expect(isOrganization(null)).toBe(false)
      expect(isOrganization(undefined)).toBe(false)
      expect(isOrganization("organization")).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates Organization using Schema's .make()", () => {
      const org = createValidOrganization()
      expect(org.name).toBe("Acme Corporation")
      expect(isOrganization(org)).toBe(true)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for Organization", () => {
      const org1 = createValidOrganization()
      const org2 = Organization.make({
        id: OrganizationId.make(validUUID),
        name: "Acme Corporation",
        reportingCurrency: USD,
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        settings: OrganizationSettings.make({})
      })
      const org3 = Organization.make({
        id: OrganizationId.make(anotherValidUUID),
        name: "Different Corp",
        reportingCurrency: EUR,
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        settings: OrganizationSettings.make({})
      })

      expect(Equal.equals(org1, org2)).toBe(true)
      expect(Equal.equals(org1, org3)).toBe(false)
    })

    it("Equal.equals is false for different timestamps", () => {
      const org1 = createValidOrganization()
      const org2 = Organization.make({
        id: OrganizationId.make(validUUID),
        name: "Acme Corporation",
        reportingCurrency: USD,
        createdAt: Timestamp.make({ epochMillis: 1718409600001 }), // Different timestamp
        settings: OrganizationSettings.make({})
      })

      expect(Equal.equals(org1, org2)).toBe(false)
    })

    it("Equal.equals is false for different settings", () => {
      const org1 = createValidOrganization()
      const org2 = Organization.make({
        id: OrganizationId.make(validUUID),
        name: "Acme Corporation",
        reportingCurrency: USD,
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        settings: OrganizationSettings.make({
          defaultLocale: "en-GB" // Different setting
        })
      })

      expect(Equal.equals(org1, org2)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes Organization", () =>
      Effect.gen(function* () {
        const original = createValidOrganization()
        const encoded = yield* Schema.encode(Organization)(original)
        const decoded = yield* Schema.decodeUnknown(Organization)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const org = createValidOrganization()
        const encoded = yield* Schema.encode(Organization)(org)

        // Verify the encoded structure has expected fields
        expect(encoded).toHaveProperty("id", validUUID)
        expect(encoded).toHaveProperty("name", "Acme Corporation")
        expect(encoded).toHaveProperty("reportingCurrency", "USD")
        expect(encoded).toHaveProperty("createdAt")
        expect(encoded).toHaveProperty("settings")
      })
    )
  })

  describe("immutability", () => {
    it("Organization properties are readonly at compile time", () => {
      const org = createValidOrganization()
      // TypeScript enforces immutability - no runtime check needed
      // Attempting to modify would be a compile-time error:
      // org.name = "New Name" // Error: Cannot assign to 'name' because it is a read-only property
      expect(org.name).toBe("Acme Corporation")
    })
  })
})
