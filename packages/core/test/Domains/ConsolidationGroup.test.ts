import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, Option, Chunk } from "effect"
import * as Schema from "effect/Schema"
import {
  ConsolidationGroupId,
  isConsolidationGroupId,
  EliminationRuleId,
  isEliminationRuleId,
  VIEDetermination,
  isVIEDetermination,
  ConsolidationMember,
  isConsolidationMember,
  ConsolidationGroup,
  isConsolidationGroup
} from "../../src/consolidation/ConsolidationGroup.ts"
import type { ConsolidationMethod } from "../../src/company/Company.ts";
import { CompanyId } from "../../src/company/Company.ts"
import { OrganizationId } from "../../src/organization/Organization.ts"
import { USD, GBP, EUR } from "../../src/currency/CurrencyCode.ts"
import { Percentage } from "../../src/shared/values/Percentage.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"

describe("ConsolidationGroupId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"
  const anotherValidUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = ConsolidationGroupId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("accepts another valid UUID format", () =>
      Effect.gen(function* () {
        const id = ConsolidationGroupId.make(anotherValidUUID)
        expect(id).toBe(anotherValidUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroupId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroupId)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects malformed UUIDs", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroupId)
        const result = yield* Effect.exit(decode("550e8400-e29b-41d4-a716-44665544000"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isConsolidationGroupId returns true for valid ConsolidationGroupId", () => {
      const id = ConsolidationGroupId.make(validUUID)
      expect(isConsolidationGroupId(id)).toBe(true)
    })

    it("isConsolidationGroupId returns true for plain UUID string (validates pattern)", () => {
      expect(isConsolidationGroupId(validUUID)).toBe(true)
    })

    it("isConsolidationGroupId returns false for non-string values", () => {
      expect(isConsolidationGroupId(null)).toBe(false)
      expect(isConsolidationGroupId(undefined)).toBe(false)
      expect(isConsolidationGroupId(123)).toBe(false)
      expect(isConsolidationGroupId({})).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates ConsolidationGroupId using Schema's .make()", () => {
      const id = ConsolidationGroupId.make(validUUID)
      expect(id).toBe(validUUID)
      expect(isConsolidationGroupId(id)).toBe(true)
    })
  })
})

describe("EliminationRuleId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = EliminationRuleId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationRuleId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isEliminationRuleId returns true for valid EliminationRuleId", () => {
      const id = EliminationRuleId.make(validUUID)
      expect(isEliminationRuleId(id)).toBe(true)
    })

    it("isEliminationRuleId returns false for non-string values", () => {
      expect(isEliminationRuleId(null)).toBe(false)
      expect(isEliminationRuleId(undefined)).toBe(false)
      expect(isEliminationRuleId(123)).toBe(false)
    })
  })
})

describe("VIEDetermination", () => {
  describe("validation", () => {
    it.effect("accepts valid VIE determination with primary beneficiary", () =>
      Effect.gen(function* () {
        const vie = VIEDetermination.make({
          isPrimaryBeneficiary: true,
          hasControllingFinancialInterest: true
        })
        expect(vie.isPrimaryBeneficiary).toBe(true)
        expect(vie.hasControllingFinancialInterest).toBe(true)
      })
    )

    it.effect("accepts VIE determination without primary beneficiary", () =>
      Effect.gen(function* () {
        const vie = VIEDetermination.make({
          isPrimaryBeneficiary: false,
          hasControllingFinancialInterest: false
        })
        expect(vie.isPrimaryBeneficiary).toBe(false)
        expect(vie.hasControllingFinancialInterest).toBe(false)
      })
    )

    it.effect("accepts mixed VIE determination", () =>
      Effect.gen(function* () {
        const vie = VIEDetermination.make({
          isPrimaryBeneficiary: true,
          hasControllingFinancialInterest: false
        })
        expect(vie.isPrimaryBeneficiary).toBe(true)
        expect(vie.hasControllingFinancialInterest).toBe(false)
      })
    )

    it.effect("rejects non-boolean isPrimaryBeneficiary", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(VIEDetermination)
        const result = yield* Effect.exit(decode({
          isPrimaryBeneficiary: "yes",
          hasControllingFinancialInterest: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-boolean hasControllingFinancialInterest", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(VIEDetermination)
        const result = yield* Effect.exit(decode({
          isPrimaryBeneficiary: true,
          hasControllingFinancialInterest: "yes"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isVIEDetermination returns true for VIEDetermination instances", () => {
      const vie = VIEDetermination.make({
        isPrimaryBeneficiary: true,
        hasControllingFinancialInterest: true
      })
      expect(isVIEDetermination(vie)).toBe(true)
    })

    it("isVIEDetermination returns false for plain objects", () => {
      expect(isVIEDetermination({
        isPrimaryBeneficiary: true,
        hasControllingFinancialInterest: true
      })).toBe(false)
    })

    it("isVIEDetermination returns false for non-object values", () => {
      expect(isVIEDetermination(null)).toBe(false)
      expect(isVIEDetermination(undefined)).toBe(false)
      expect(isVIEDetermination("vie")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for VIEDetermination", () => {
      const vie1 = VIEDetermination.make({
        isPrimaryBeneficiary: true,
        hasControllingFinancialInterest: true
      })
      const vie2 = VIEDetermination.make({
        isPrimaryBeneficiary: true,
        hasControllingFinancialInterest: true
      })
      const vie3 = VIEDetermination.make({
        isPrimaryBeneficiary: false,
        hasControllingFinancialInterest: true
      })

      expect(Equal.equals(vie1, vie2)).toBe(true)
      expect(Equal.equals(vie1, vie3)).toBe(false)
    })
  })
})

describe("ConsolidationMember", () => {
  const companyUUID = "550e8400-e29b-41d4-a716-446655440000"
  const acquisitionDate = LocalDate.make({ year: 2024, month: 1, day: 15 })

  const createFullConsolidationMember = () => {
    return ConsolidationMember.make({
      companyId: CompanyId.make(companyUUID),
      ownershipPercentage: Percentage.make(80),
      consolidationMethod: "FullConsolidation",
      acquisitionDate,
      goodwillAmount: Option.some(MonetaryAmount.unsafeFromString("1000000", "USD")),
      nonControllingInterestPercentage: Percentage.make(20),
      vieDetermination: Option.none()
    })
  }

  const createEquityMethodMember = () => {
    return ConsolidationMember.make({
      companyId: CompanyId.make(companyUUID),
      ownershipPercentage: Percentage.make(30),
      consolidationMethod: "EquityMethod",
      acquisitionDate,
      goodwillAmount: Option.none(),
      nonControllingInterestPercentage: Percentage.make(70),
      vieDetermination: Option.none()
    })
  }

  const createCostMethodMember = () => {
    return ConsolidationMember.make({
      companyId: CompanyId.make(companyUUID),
      ownershipPercentage: Percentage.make(10),
      consolidationMethod: "CostMethod",
      acquisitionDate,
      goodwillAmount: Option.none(),
      nonControllingInterestPercentage: Percentage.make(90),
      vieDetermination: Option.none()
    })
  }

  const createVIEMember = () => {
    return ConsolidationMember.make({
      companyId: CompanyId.make(companyUUID),
      ownershipPercentage: Percentage.make(15),
      consolidationMethod: "VariableInterestEntity",
      acquisitionDate,
      goodwillAmount: Option.none(),
      nonControllingInterestPercentage: Percentage.make(85),
      vieDetermination: Option.some(VIEDetermination.make({
        isPrimaryBeneficiary: true,
        hasControllingFinancialInterest: true
      }))
    })
  }

  describe("validation", () => {
    it.effect("accepts valid full consolidation member", () =>
      Effect.gen(function* () {
        const member = createFullConsolidationMember()
        expect(member.companyId).toBe(companyUUID)
        expect(member.ownershipPercentage).toBe(80)
        expect(member.consolidationMethod).toBe("FullConsolidation")
        expect(member.nonControllingInterestPercentage).toBe(20)
        expect(Option.isSome(member.goodwillAmount)).toBe(true)
        expect(Option.isNone(member.vieDetermination)).toBe(true)
      })
    )

    it.effect("accepts valid equity method member", () =>
      Effect.gen(function* () {
        const member = createEquityMethodMember()
        expect(member.ownershipPercentage).toBe(30)
        expect(member.consolidationMethod).toBe("EquityMethod")
        expect(member.nonControllingInterestPercentage).toBe(70)
      })
    )

    it.effect("accepts valid cost method member", () =>
      Effect.gen(function* () {
        const member = createCostMethodMember()
        expect(member.ownershipPercentage).toBe(10)
        expect(member.consolidationMethod).toBe("CostMethod")
        expect(member.nonControllingInterestPercentage).toBe(90)
      })
    )

    it.effect("accepts valid VIE member", () =>
      Effect.gen(function* () {
        const member = createVIEMember()
        expect(member.ownershipPercentage).toBe(15)
        expect(member.consolidationMethod).toBe("VariableInterestEntity")
        expect(Option.isSome(member.vieDetermination)).toBe(true)
      })
    )

    it.effect("accepts 100% ownership", () =>
      Effect.gen(function* () {
        const member = ConsolidationMember.make({
          companyId: CompanyId.make(companyUUID),
          ownershipPercentage: Percentage.make(100),
          consolidationMethod: "FullConsolidation",
          acquisitionDate,
          goodwillAmount: Option.none(),
          nonControllingInterestPercentage: Percentage.make(0),
          vieDetermination: Option.none()
        })
        expect(member.ownershipPercentage).toBe(100)
        expect(member.nonControllingInterestPercentage).toBe(0)
      })
    )

    it.effect("accepts 0% ownership (for tracking purposes)", () =>
      Effect.gen(function* () {
        const member = ConsolidationMember.make({
          companyId: CompanyId.make(companyUUID),
          ownershipPercentage: Percentage.make(0),
          consolidationMethod: "CostMethod",
          acquisitionDate,
          goodwillAmount: Option.none(),
          nonControllingInterestPercentage: Percentage.make(100),
          vieDetermination: Option.none()
        })
        expect(member.ownershipPercentage).toBe(0)
      })
    )

    it.effect("rejects invalid company ID", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationMember)
        const result = yield* Effect.exit(decode({
          companyId: "invalid-id",
          ownershipPercentage: 80,
          consolidationMethod: "FullConsolidation",
          acquisitionDate: { year: 2024, month: 1, day: 15 },
          goodwillAmount: null,
          nonControllingInterestPercentage: 20,
          vieDetermination: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid ownership percentage", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationMember)
        const result = yield* Effect.exit(decode({
          companyId: companyUUID,
          ownershipPercentage: 150, // > 100
          consolidationMethod: "FullConsolidation",
          acquisitionDate: { year: 2024, month: 1, day: 15 },
          goodwillAmount: null,
          nonControllingInterestPercentage: 20,
          vieDetermination: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects negative ownership percentage", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationMember)
        const result = yield* Effect.exit(decode({
          companyId: companyUUID,
          ownershipPercentage: -10,
          consolidationMethod: "FullConsolidation",
          acquisitionDate: { year: 2024, month: 1, day: 15 },
          goodwillAmount: null,
          nonControllingInterestPercentage: 20,
          vieDetermination: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid consolidation method", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationMember)
        const result = yield* Effect.exit(decode({
          companyId: companyUUID,
          ownershipPercentage: 80,
          consolidationMethod: "InvalidMethod",
          acquisitionDate: { year: 2024, month: 1, day: 15 },
          goodwillAmount: null,
          nonControllingInterestPercentage: 20,
          vieDetermination: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid acquisition date", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationMember)
        const result = yield* Effect.exit(decode({
          companyId: companyUUID,
          ownershipPercentage: 80,
          consolidationMethod: "FullConsolidation",
          acquisitionDate: { year: 2024, month: 13, day: 15 }, // Invalid month
          goodwillAmount: null,
          nonControllingInterestPercentage: 20,
          vieDetermination: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("computed properties", () => {
    it("isFullyConsolidated returns true for FullConsolidation", () => {
      const member = createFullConsolidationMember()
      expect(member.isFullyConsolidated).toBe(true)
    })

    it("isFullyConsolidated returns true for VIE", () => {
      const member = createVIEMember()
      expect(member.isFullyConsolidated).toBe(true)
    })

    it("isFullyConsolidated returns false for EquityMethod", () => {
      const member = createEquityMethodMember()
      expect(member.isFullyConsolidated).toBe(false)
    })

    it("isFullyConsolidated returns false for CostMethod", () => {
      const member = createCostMethodMember()
      expect(member.isFullyConsolidated).toBe(false)
    })

    it("isEquityMethod returns true for EquityMethod", () => {
      const member = createEquityMethodMember()
      expect(member.isEquityMethod).toBe(true)
    })

    it("isEquityMethod returns false for other methods", () => {
      expect(createFullConsolidationMember().isEquityMethod).toBe(false)
      expect(createCostMethodMember().isEquityMethod).toBe(false)
      expect(createVIEMember().isEquityMethod).toBe(false)
    })

    it("isCostMethod returns true for CostMethod", () => {
      const member = createCostMethodMember()
      expect(member.isCostMethod).toBe(true)
    })

    it("isCostMethod returns false for other methods", () => {
      expect(createFullConsolidationMember().isCostMethod).toBe(false)
      expect(createEquityMethodMember().isCostMethod).toBe(false)
      expect(createVIEMember().isCostMethod).toBe(false)
    })

    it("isVIE returns true for VariableInterestEntity", () => {
      const member = createVIEMember()
      expect(member.isVIE).toBe(true)
    })

    it("isVIE returns false for other methods", () => {
      expect(createFullConsolidationMember().isVIE).toBe(false)
      expect(createEquityMethodMember().isVIE).toBe(false)
      expect(createCostMethodMember().isVIE).toBe(false)
    })

    it("isMajorityOwned returns true for >50% ownership", () => {
      const member = createFullConsolidationMember()
      expect(member.isMajorityOwned).toBe(true)
    })

    it("isMajorityOwned returns false for <=50% ownership", () => {
      expect(createEquityMethodMember().isMajorityOwned).toBe(false)
      expect(createCostMethodMember().isMajorityOwned).toBe(false)
    })

    it("isMajorityOwned returns false for exactly 50%", () => {
      const member = ConsolidationMember.make({
        companyId: CompanyId.make(companyUUID),
        ownershipPercentage: Percentage.make(50),
        consolidationMethod: "EquityMethod",
        acquisitionDate,
        goodwillAmount: Option.none(),
        nonControllingInterestPercentage: Percentage.make(50),
        vieDetermination: Option.none()
      })
      expect(member.isMajorityOwned).toBe(false)
    })

    it("hasNonControllingInterest returns true when NCI > 0", () => {
      const member = createFullConsolidationMember()
      expect(member.hasNonControllingInterest).toBe(true)
    })

    it("hasNonControllingInterest returns false when NCI = 0", () => {
      const member = ConsolidationMember.make({
        companyId: CompanyId.make(companyUUID),
        ownershipPercentage: Percentage.make(100),
        consolidationMethod: "FullConsolidation",
        acquisitionDate,
        goodwillAmount: Option.none(),
        nonControllingInterestPercentage: Percentage.make(0),
        vieDetermination: Option.none()
      })
      expect(member.hasNonControllingInterest).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isConsolidationMember returns true for ConsolidationMember instances", () => {
      const member = createFullConsolidationMember()
      expect(isConsolidationMember(member)).toBe(true)
    })

    it("isConsolidationMember returns false for plain objects", () => {
      expect(isConsolidationMember({
        companyId: companyUUID,
        ownershipPercentage: 80,
        consolidationMethod: "FullConsolidation",
        acquisitionDate: { year: 2024, month: 1, day: 15 },
        goodwillAmount: null,
        nonControllingInterestPercentage: 20,
        vieDetermination: null
      })).toBe(false)
    })

    it("isConsolidationMember returns false for non-object values", () => {
      expect(isConsolidationMember(null)).toBe(false)
      expect(isConsolidationMember(undefined)).toBe(false)
      expect(isConsolidationMember("member")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for ConsolidationMember", () => {
      const member1 = createFullConsolidationMember()
      const member2 = createFullConsolidationMember()
      const member3 = createEquityMethodMember()

      expect(Equal.equals(member1, member2)).toBe(true)
      expect(Equal.equals(member1, member3)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes ConsolidationMember with goodwill", () =>
      Effect.gen(function* () {
        const original = createFullConsolidationMember()
        const encoded = yield* Schema.encode(ConsolidationMember)(original)
        const decoded = yield* Schema.decodeUnknown(ConsolidationMember)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes ConsolidationMember without goodwill", () =>
      Effect.gen(function* () {
        const original = createEquityMethodMember()
        const encoded = yield* Schema.encode(ConsolidationMember)(original)
        const decoded = yield* Schema.decodeUnknown(ConsolidationMember)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes VIE member with determination", () =>
      Effect.gen(function* () {
        const original = createVIEMember()
        const encoded = yield* Schema.encode(ConsolidationMember)(original)
        const decoded = yield* Schema.decodeUnknown(ConsolidationMember)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const member = createFullConsolidationMember()
        const encoded = yield* Schema.encode(ConsolidationMember)(member)

        expect(encoded).toHaveProperty("companyId", companyUUID)
        expect(encoded).toHaveProperty("ownershipPercentage", 80)
        expect(encoded).toHaveProperty("consolidationMethod", "FullConsolidation")
        expect(encoded).toHaveProperty("nonControllingInterestPercentage", 20)
        expect(encoded).toHaveProperty("vieDetermination", null)
      })
    )
  })
})

describe("ConsolidationGroup", () => {
  const groupUUID = "550e8400-e29b-41d4-a716-446655440000"
  const orgUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const parentCompanyUUID = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const subsidiaryUUID1 = "8ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const subsidiaryUUID2 = "9ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const eliminationRuleUUID1 = "aba7b810-9dad-11d1-80b4-00c04fd430c8"
  const eliminationRuleUUID2 = "bba7b810-9dad-11d1-80b4-00c04fd430c8"

  const acquisitionDate = LocalDate.make({ year: 2024, month: 1, day: 15 })

  const createFullyConsolidatedMember = (companyId: string, ownership: number) => {
    return ConsolidationMember.make({
      companyId: CompanyId.make(companyId),
      ownershipPercentage: Percentage.make(ownership),
      consolidationMethod: "FullConsolidation",
      acquisitionDate,
      goodwillAmount: Option.none(),
      nonControllingInterestPercentage: Percentage.make(100 - ownership),
      vieDetermination: Option.none()
    })
  }

  const createEquityMember = (companyId: string, ownership: number) => {
    return ConsolidationMember.make({
      companyId: CompanyId.make(companyId),
      ownershipPercentage: Percentage.make(ownership),
      consolidationMethod: "EquityMethod",
      acquisitionDate,
      goodwillAmount: Option.none(),
      nonControllingInterestPercentage: Percentage.make(100 - ownership),
      vieDetermination: Option.none()
    })
  }

  const createGroupWithMembers = () => {
    return ConsolidationGroup.make({
      id: ConsolidationGroupId.make(groupUUID),
      organizationId: OrganizationId.make(orgUUID),
      name: "Acme Consolidated Group",
      reportingCurrency: USD,
      consolidationMethod: "FullConsolidation",
      parentCompanyId: CompanyId.make(parentCompanyUUID),
      members: Chunk.make(
        createFullyConsolidatedMember(subsidiaryUUID1, 80),
        createEquityMember(subsidiaryUUID2, 30)
      ),
      eliminationRuleIds: Chunk.make(
        EliminationRuleId.make(eliminationRuleUUID1),
        EliminationRuleId.make(eliminationRuleUUID2)
      ),
      isActive: true
    })
  }

  const createEmptyGroup = () => {
    return ConsolidationGroup.make({
      id: ConsolidationGroupId.make(groupUUID),
      organizationId: OrganizationId.make(orgUUID),
      name: "Empty Group",
      reportingCurrency: USD,
      consolidationMethod: "FullConsolidation",
      parentCompanyId: CompanyId.make(parentCompanyUUID),
      members: Chunk.empty(),
      eliminationRuleIds: Chunk.empty(),
      isActive: true
    })
  }

  describe("validation", () => {
    it.effect("accepts valid consolidation group with members", () =>
      Effect.gen(function* () {
        const group = createGroupWithMembers()
        expect(group.id).toBe(groupUUID)
        expect(group.organizationId).toBe(orgUUID)
        expect(group.name).toBe("Acme Consolidated Group")
        expect(group.reportingCurrency).toBe(USD)
        expect(group.consolidationMethod).toBe("FullConsolidation")
        expect(group.parentCompanyId).toBe(parentCompanyUUID)
        expect(Chunk.size(group.members)).toBe(2)
        expect(Chunk.size(group.eliminationRuleIds)).toBe(2)
        expect(group.isActive).toBe(true)
      })
    )

    it.effect("accepts group with empty members", () =>
      Effect.gen(function* () {
        const group = createEmptyGroup()
        expect(Chunk.size(group.members)).toBe(0)
        expect(Chunk.size(group.eliminationRuleIds)).toBe(0)
      })
    )

    it.effect("accepts group with different reporting currencies", () =>
      Effect.gen(function* () {
        const groupEUR = ConsolidationGroup.make({
          id: ConsolidationGroupId.make(groupUUID),
          organizationId: OrganizationId.make(orgUUID),
          name: "Euro Group",
          reportingCurrency: EUR,
          consolidationMethod: "FullConsolidation",
          parentCompanyId: CompanyId.make(parentCompanyUUID),
          members: Chunk.empty(),
          eliminationRuleIds: Chunk.empty(),
          isActive: true
        })
        expect(groupEUR.reportingCurrency).toBe(EUR)

        const groupGBP = ConsolidationGroup.make({
          id: ConsolidationGroupId.make(groupUUID),
          organizationId: OrganizationId.make(orgUUID),
          name: "GBP Group",
          reportingCurrency: GBP,
          consolidationMethod: "FullConsolidation",
          parentCompanyId: CompanyId.make(parentCompanyUUID),
          members: Chunk.empty(),
          eliminationRuleIds: Chunk.empty(),
          isActive: true
        })
        expect(groupGBP.reportingCurrency).toBe(GBP)
      })
    )

    it.effect("accepts all consolidation methods for group", () =>
      Effect.gen(function* () {
        const methods: ConsolidationMethod[] = [
          "FullConsolidation",
          "EquityMethod",
          "CostMethod",
          "VariableInterestEntity"
        ]

        for (const method of methods) {
          const group = ConsolidationGroup.make({
            id: ConsolidationGroupId.make(groupUUID),
            organizationId: OrganizationId.make(orgUUID),
            name: `${method} Group`,
            reportingCurrency: USD,
            consolidationMethod: method,
            parentCompanyId: CompanyId.make(parentCompanyUUID),
            members: Chunk.empty(),
            eliminationRuleIds: Chunk.empty(),
            isActive: true
          })
          expect(group.consolidationMethod).toBe(method)
        }
      })
    )

    it.effect("accepts inactive group", () =>
      Effect.gen(function* () {
        const group = ConsolidationGroup.make({
          id: ConsolidationGroupId.make(groupUUID),
          organizationId: OrganizationId.make(orgUUID),
          name: "Inactive Group",
          reportingCurrency: USD,
          consolidationMethod: "FullConsolidation",
          parentCompanyId: CompanyId.make(parentCompanyUUID),
          members: Chunk.empty(),
          eliminationRuleIds: Chunk.empty(),
          isActive: false
        })
        expect(group.isActive).toBe(false)
      })
    )

    it.effect("rejects invalid group id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroup)
        const result = yield* Effect.exit(decode({
          id: "invalid-id",
          organizationId: orgUUID,
          name: "Test Group",
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentCompanyUUID,
          members: [],
          eliminationRuleIds: [],
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid organization id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroup)
        const result = yield* Effect.exit(decode({
          id: groupUUID,
          organizationId: "invalid-id",
          name: "Test Group",
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentCompanyUUID,
          members: [],
          eliminationRuleIds: [],
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroup)
        const result = yield* Effect.exit(decode({
          id: groupUUID,
          organizationId: orgUUID,
          name: "",
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentCompanyUUID,
          members: [],
          eliminationRuleIds: [],
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid currency code", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroup)
        const result = yield* Effect.exit(decode({
          id: groupUUID,
          organizationId: orgUUID,
          name: "Test Group",
          reportingCurrency: "INVALID",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentCompanyUUID,
          members: [],
          eliminationRuleIds: [],
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid consolidation method", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroup)
        const result = yield* Effect.exit(decode({
          id: groupUUID,
          organizationId: orgUUID,
          name: "Test Group",
          reportingCurrency: "USD",
          consolidationMethod: "InvalidMethod",
          parentCompanyId: parentCompanyUUID,
          members: [],
          eliminationRuleIds: [],
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid parent company id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroup)
        const result = yield* Effect.exit(decode({
          id: groupUUID,
          organizationId: orgUUID,
          name: "Test Group",
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: "invalid-id",
          members: [],
          eliminationRuleIds: [],
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid member in members array", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroup)
        const result = yield* Effect.exit(decode({
          id: groupUUID,
          organizationId: orgUUID,
          name: "Test Group",
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentCompanyUUID,
          members: [{
            companyId: "invalid-id", // Invalid UUID
            ownershipPercentage: 80,
            consolidationMethod: "FullConsolidation",
            acquisitionDate: { year: 2024, month: 1, day: 15 },
            goodwillAmount: null,
            nonControllingInterestPercentage: 20,
            vieDetermination: null
          }],
          eliminationRuleIds: [],
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid elimination rule id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationGroup)
        const result = yield* Effect.exit(decode({
          id: groupUUID,
          organizationId: orgUUID,
          name: "Test Group",
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentCompanyUUID,
          members: [],
          eliminationRuleIds: ["invalid-id"],
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("computed properties", () => {
    it("memberCount returns correct count", () => {
      expect(createGroupWithMembers().memberCount).toBe(2)
      expect(createEmptyGroup().memberCount).toBe(0)
    })

    it("hasMembers returns true when members exist", () => {
      expect(createGroupWithMembers().hasMembers).toBe(true)
    })

    it("hasMembers returns false for empty group", () => {
      expect(createEmptyGroup().hasMembers).toBe(false)
    })

    it("fullyConsolidatedMembers filters correctly", () => {
      const group = createGroupWithMembers()
      const fullyConsolidated = group.fullyConsolidatedMembers
      expect(Chunk.size(fullyConsolidated)).toBe(1)
      expect(Chunk.unsafeGet(fullyConsolidated, 0).companyId).toBe(subsidiaryUUID1)
    })

    it("equityMethodMembers filters correctly", () => {
      const group = createGroupWithMembers()
      const equityMethod = group.equityMethodMembers
      expect(Chunk.size(equityMethod)).toBe(1)
      expect(Chunk.unsafeGet(equityMethod, 0).companyId).toBe(subsidiaryUUID2)
    })

    it("costMethodMembers returns empty for group without cost method members", () => {
      const group = createGroupWithMembers()
      expect(Chunk.isEmpty(group.costMethodMembers)).toBe(true)
    })

    it("vieMembers returns empty for group without VIE members", () => {
      const group = createGroupWithMembers()
      expect(Chunk.isEmpty(group.vieMembers)).toBe(true)
    })

    it("eliminationRuleCount returns correct count", () => {
      expect(createGroupWithMembers().eliminationRuleCount).toBe(2)
      expect(createEmptyGroup().eliminationRuleCount).toBe(0)
    })

    it("hasEliminationRules returns true when rules exist", () => {
      expect(createGroupWithMembers().hasEliminationRules).toBe(true)
    })

    it("hasEliminationRules returns false for empty group", () => {
      expect(createEmptyGroup().hasEliminationRules).toBe(false)
    })

    it("findMemberByCompanyId returns member when found", () => {
      const group = createGroupWithMembers()
      const member = group.findMemberByCompanyId(CompanyId.make(subsidiaryUUID1))
      expect(member).toBeDefined()
      expect(member!.companyId).toBe(subsidiaryUUID1)
    })

    it("findMemberByCompanyId returns undefined when not found", () => {
      const group = createGroupWithMembers()
      const unknownUUID = "cba7b810-9dad-11d1-80b4-00c04fd430c8"
      const member = group.findMemberByCompanyId(CompanyId.make(unknownUUID))
      expect(member).toBeUndefined()
    })

    it("hasMember returns true for existing member", () => {
      const group = createGroupWithMembers()
      expect(group.hasMember(CompanyId.make(subsidiaryUUID1))).toBe(true)
      expect(group.hasMember(CompanyId.make(subsidiaryUUID2))).toBe(true)
    })

    it("hasMember returns false for non-member", () => {
      const group = createGroupWithMembers()
      const unknownUUID = "cba7b810-9dad-11d1-80b4-00c04fd430c8"
      expect(group.hasMember(CompanyId.make(unknownUUID))).toBe(false)
    })

    it("allCompanyIds includes parent and all members", () => {
      const group = createGroupWithMembers()
      const allIds = group.allCompanyIds
      expect(Chunk.size(allIds)).toBe(3)
      expect(Chunk.toArray(allIds)).toContain(parentCompanyUUID)
      expect(Chunk.toArray(allIds)).toContain(subsidiaryUUID1)
      expect(Chunk.toArray(allIds)).toContain(subsidiaryUUID2)
    })

    it("allCompanyIds for empty group contains only parent", () => {
      const group = createEmptyGroup()
      const allIds = group.allCompanyIds
      expect(Chunk.size(allIds)).toBe(1)
      expect(Chunk.unsafeGet(allIds, 0)).toBe(parentCompanyUUID)
    })
  })

  describe("type guard", () => {
    it("isConsolidationGroup returns true for ConsolidationGroup instances", () => {
      const group = createGroupWithMembers()
      expect(isConsolidationGroup(group)).toBe(true)
    })

    it("isConsolidationGroup returns false for plain objects", () => {
      expect(isConsolidationGroup({
        id: groupUUID,
        organizationId: orgUUID,
        name: "Test Group",
        reportingCurrency: "USD",
        consolidationMethod: "FullConsolidation",
        parentCompanyId: parentCompanyUUID,
        members: [],
        eliminationRuleIds: [],
        isActive: true
      })).toBe(false)
    })

    it("isConsolidationGroup returns false for non-object values", () => {
      expect(isConsolidationGroup(null)).toBe(false)
      expect(isConsolidationGroup(undefined)).toBe(false)
      expect(isConsolidationGroup("group")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for ConsolidationGroup", () => {
      const group1 = createGroupWithMembers()
      const group2 = createGroupWithMembers()
      const group3 = createEmptyGroup()

      expect(Equal.equals(group1, group2)).toBe(true)
      expect(Equal.equals(group1, group3)).toBe(false)
    })

    it("Equal.equals is false for different members", () => {
      const group1 = createGroupWithMembers()
      const group2 = ConsolidationGroup.make({
        id: ConsolidationGroupId.make(groupUUID),
        organizationId: OrganizationId.make(orgUUID),
        name: "Acme Consolidated Group",
        reportingCurrency: USD,
        consolidationMethod: "FullConsolidation",
        parentCompanyId: CompanyId.make(parentCompanyUUID),
        members: Chunk.make(
          createFullyConsolidatedMember(subsidiaryUUID1, 90) // Different ownership
        ),
        eliminationRuleIds: Chunk.make(
          EliminationRuleId.make(eliminationRuleUUID1),
          EliminationRuleId.make(eliminationRuleUUID2)
        ),
        isActive: true
      })

      expect(Equal.equals(group1, group2)).toBe(false)
    })

    it("Equal.equals is false for different elimination rules", () => {
      const group1 = createGroupWithMembers()
      const group2 = ConsolidationGroup.make({
        id: ConsolidationGroupId.make(groupUUID),
        organizationId: OrganizationId.make(orgUUID),
        name: "Acme Consolidated Group",
        reportingCurrency: USD,
        consolidationMethod: "FullConsolidation",
        parentCompanyId: CompanyId.make(parentCompanyUUID),
        members: Chunk.make(
          createFullyConsolidatedMember(subsidiaryUUID1, 80),
          createEquityMember(subsidiaryUUID2, 30)
        ),
        eliminationRuleIds: Chunk.make(
          EliminationRuleId.make(eliminationRuleUUID1)
          // Missing second rule
        ),
        isActive: true
      })

      expect(Equal.equals(group1, group2)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes ConsolidationGroup with members", () =>
      Effect.gen(function* () {
        const original = createGroupWithMembers()
        const encoded = yield* Schema.encode(ConsolidationGroup)(original)
        const decoded = yield* Schema.decodeUnknown(ConsolidationGroup)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes empty ConsolidationGroup", () =>
      Effect.gen(function* () {
        const original = createEmptyGroup()
        const encoded = yield* Schema.encode(ConsolidationGroup)(original)
        const decoded = yield* Schema.decodeUnknown(ConsolidationGroup)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const group = createGroupWithMembers()
        const encoded = yield* Schema.encode(ConsolidationGroup)(group)

        expect(encoded).toHaveProperty("id", groupUUID)
        expect(encoded).toHaveProperty("organizationId", orgUUID)
        expect(encoded).toHaveProperty("name", "Acme Consolidated Group")
        expect(encoded).toHaveProperty("reportingCurrency", "USD")
        expect(encoded).toHaveProperty("consolidationMethod", "FullConsolidation")
        expect(encoded).toHaveProperty("parentCompanyId", parentCompanyUUID)
        expect(encoded).toHaveProperty("isActive", true)
        expect(Array.isArray(encoded.members)).toBe(true)
        expect(encoded.members).toHaveLength(2)
        expect(Array.isArray(encoded.eliminationRuleIds)).toBe(true)
        expect(encoded.eliminationRuleIds).toHaveLength(2)
      })
    )

    it.effect("encodes members array correctly", () =>
      Effect.gen(function* () {
        const group = createGroupWithMembers()
        const encoded = yield* Schema.encode(ConsolidationGroup)(group)

        const member1 = encoded.members[0]
        expect(member1).toHaveProperty("companyId", subsidiaryUUID1)
        expect(member1).toHaveProperty("ownershipPercentage", 80)
        expect(member1).toHaveProperty("consolidationMethod", "FullConsolidation")

        const member2 = encoded.members[1]
        expect(member2).toHaveProperty("companyId", subsidiaryUUID2)
        expect(member2).toHaveProperty("ownershipPercentage", 30)
        expect(member2).toHaveProperty("consolidationMethod", "EquityMethod")
      })
    )
  })

  describe("immutability", () => {
    it("ConsolidationGroup properties are readonly at compile time", () => {
      const group = createGroupWithMembers()
      expect(group.name).toBe("Acme Consolidated Group")
      expect(group.isActive).toBe(true)
    })
  })

  describe("VIE members in group", () => {
    it("correctly handles group with VIE members", () => {
      const vieSubsidiaryUUID = "dba7b810-9dad-11d1-80b4-00c04fd430c8"
      const group = ConsolidationGroup.make({
        id: ConsolidationGroupId.make(groupUUID),
        organizationId: OrganizationId.make(orgUUID),
        name: "Group with VIE",
        reportingCurrency: USD,
        consolidationMethod: "FullConsolidation",
        parentCompanyId: CompanyId.make(parentCompanyUUID),
        members: Chunk.make(
          createFullyConsolidatedMember(subsidiaryUUID1, 80),
          ConsolidationMember.make({
            companyId: CompanyId.make(vieSubsidiaryUUID),
            ownershipPercentage: Percentage.make(15),
            consolidationMethod: "VariableInterestEntity",
            acquisitionDate,
            goodwillAmount: Option.none(),
            nonControllingInterestPercentage: Percentage.make(85),
            vieDetermination: Option.some(VIEDetermination.make({
              isPrimaryBeneficiary: true,
              hasControllingFinancialInterest: true
            }))
          })
        ),
        eliminationRuleIds: Chunk.empty(),
        isActive: true
      })

      expect(Chunk.size(group.vieMembers)).toBe(1)
      expect(Chunk.size(group.fullyConsolidatedMembers)).toBe(2) // Both full cons and VIE
      expect(Chunk.unsafeGet(group.vieMembers, 0).companyId).toBe(vieSubsidiaryUUID)
    })
  })
})
