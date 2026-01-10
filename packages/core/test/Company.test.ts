import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  CompanyId,
  isCompanyId,
  ConsolidationMethod,
  isConsolidationMethod,
  FiscalYearEnd,
  isFiscalYearEnd,
  CALENDAR_YEAR_END,
  FISCAL_YEAR_END_MARCH,
  FISCAL_YEAR_END_JUNE,
  FISCAL_YEAR_END_SEPTEMBER,
  Company,
  isCompany
} from "../src/Company.js"
import { OrganizationId } from "../src/Organization.js"
import { CurrencyCode, USD, EUR, GBP } from "../src/CurrencyCode.js"
import { JurisdictionCode, US, GB } from "../src/JurisdictionCode.js"
import { Percentage } from "../src/Percentage.js"
import { Timestamp } from "../src/Timestamp.js"

describe("CompanyId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"
  const anotherValidUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = CompanyId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("accepts another valid UUID format", () =>
      Effect.gen(function* () {
        const id = CompanyId.make(anotherValidUUID)
        expect(id).toBe(anotherValidUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CompanyId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CompanyId)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects malformed UUIDs", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CompanyId)
        const result = yield* Effect.exit(decode("550e8400-e29b-41d4-a716-44665544000"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isCompanyId returns true for valid CompanyId", () => {
      const id = CompanyId.make(validUUID)
      expect(isCompanyId(id)).toBe(true)
    })

    it("isCompanyId returns true for plain UUID string (validates pattern)", () => {
      expect(isCompanyId(validUUID)).toBe(true)
    })

    it("isCompanyId returns false for non-string values", () => {
      expect(isCompanyId(null)).toBe(false)
      expect(isCompanyId(undefined)).toBe(false)
      expect(isCompanyId(123)).toBe(false)
      expect(isCompanyId({})).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates CompanyId using Schema's .make()", () => {
      const id = CompanyId.make(validUUID)
      expect(id).toBe(validUUID)
      expect(isCompanyId(id)).toBe(true)
    })
  })
})

describe("ConsolidationMethod", () => {
  describe("validation", () => {
    it.effect("accepts FullConsolidation", () =>
      Effect.gen(function* () {
        const method = yield* Schema.decodeUnknown(ConsolidationMethod)("FullConsolidation")
        expect(method).toBe("FullConsolidation")
      })
    )

    it.effect("accepts EquityMethod", () =>
      Effect.gen(function* () {
        const method = yield* Schema.decodeUnknown(ConsolidationMethod)("EquityMethod")
        expect(method).toBe("EquityMethod")
      })
    )

    it.effect("accepts CostMethod", () =>
      Effect.gen(function* () {
        const method = yield* Schema.decodeUnknown(ConsolidationMethod)("CostMethod")
        expect(method).toBe("CostMethod")
      })
    )

    it.effect("accepts VariableInterestEntity", () =>
      Effect.gen(function* () {
        const method = yield* Schema.decodeUnknown(ConsolidationMethod)("VariableInterestEntity")
        expect(method).toBe("VariableInterestEntity")
      })
    )

    it.effect("rejects invalid consolidation methods", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationMethod)
        const result = yield* Effect.exit(decode("InvalidMethod"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationMethod)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-string values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ConsolidationMethod)
        const result = yield* Effect.exit(decode(123))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isConsolidationMethod returns true for valid methods", () => {
      expect(isConsolidationMethod("FullConsolidation")).toBe(true)
      expect(isConsolidationMethod("EquityMethod")).toBe(true)
      expect(isConsolidationMethod("CostMethod")).toBe(true)
      expect(isConsolidationMethod("VariableInterestEntity")).toBe(true)
    })

    it("isConsolidationMethod returns false for invalid methods", () => {
      expect(isConsolidationMethod("InvalidMethod")).toBe(false)
      expect(isConsolidationMethod("")).toBe(false)
      expect(isConsolidationMethod(null)).toBe(false)
      expect(isConsolidationMethod(undefined)).toBe(false)
    })
  })
})

describe("FiscalYearEnd", () => {
  describe("validation", () => {
    it.effect("accepts valid month and day", () =>
      Effect.gen(function* () {
        const fye = FiscalYearEnd.make({ month: 12, day: 31 })
        expect(fye.month).toBe(12)
        expect(fye.day).toBe(31)
      })
    )

    it.effect("accepts all valid months", () =>
      Effect.gen(function* () {
        for (let month = 1; month <= 12; month++) {
          const fye = FiscalYearEnd.make({ month, day: 1 })
          expect(fye.month).toBe(month)
        }
      })
    )

    it.effect("accepts days 1-31", () =>
      Effect.gen(function* () {
        for (let day = 1; day <= 31; day++) {
          const fye = FiscalYearEnd.make({ month: 1, day })
          expect(fye.day).toBe(day)
        }
      })
    )

    it.effect("rejects month 0", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalYearEnd)
        const result = yield* Effect.exit(decode({ month: 0, day: 15 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects month 13", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalYearEnd)
        const result = yield* Effect.exit(decode({ month: 13, day: 15 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects day 0", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalYearEnd)
        const result = yield* Effect.exit(decode({ month: 6, day: 0 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects day 32", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalYearEnd)
        const result = yield* Effect.exit(decode({ month: 6, day: 32 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-integer month", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalYearEnd)
        const result = yield* Effect.exit(decode({ month: 6.5, day: 15 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-integer day", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalYearEnd)
        const result = yield* Effect.exit(decode({ month: 6, day: 15.5 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("computed properties", () => {
    it("isCalendarYearEnd returns true for December 31", () => {
      const fye = FiscalYearEnd.make({ month: 12, day: 31 })
      expect(fye.isCalendarYearEnd).toBe(true)
    })

    it("isCalendarYearEnd returns false for other dates", () => {
      const march = FiscalYearEnd.make({ month: 3, day: 31 })
      expect(march.isCalendarYearEnd).toBe(false)

      const december30 = FiscalYearEnd.make({ month: 12, day: 30 })
      expect(december30.isCalendarYearEnd).toBe(false)
    })

    it("toDisplayString formats correctly", () => {
      expect(CALENDAR_YEAR_END.toDisplayString()).toBe("December 31")
      expect(FISCAL_YEAR_END_MARCH.toDisplayString()).toBe("March 31")
      expect(FISCAL_YEAR_END_JUNE.toDisplayString()).toBe("June 30")
      expect(FISCAL_YEAR_END_SEPTEMBER.toDisplayString()).toBe("September 30")
    })
  })

  describe("predefined constants", () => {
    it("CALENDAR_YEAR_END is December 31", () => {
      expect(CALENDAR_YEAR_END.month).toBe(12)
      expect(CALENDAR_YEAR_END.day).toBe(31)
    })

    it("FISCAL_YEAR_END_MARCH is March 31", () => {
      expect(FISCAL_YEAR_END_MARCH.month).toBe(3)
      expect(FISCAL_YEAR_END_MARCH.day).toBe(31)
    })

    it("FISCAL_YEAR_END_JUNE is June 30", () => {
      expect(FISCAL_YEAR_END_JUNE.month).toBe(6)
      expect(FISCAL_YEAR_END_JUNE.day).toBe(30)
    })

    it("FISCAL_YEAR_END_SEPTEMBER is September 30", () => {
      expect(FISCAL_YEAR_END_SEPTEMBER.month).toBe(9)
      expect(FISCAL_YEAR_END_SEPTEMBER.day).toBe(30)
    })
  })

  describe("type guard", () => {
    it("isFiscalYearEnd returns true for FiscalYearEnd instances", () => {
      const fye = FiscalYearEnd.make({ month: 12, day: 31 })
      expect(isFiscalYearEnd(fye)).toBe(true)
    })

    it("isFiscalYearEnd returns false for plain objects", () => {
      expect(isFiscalYearEnd({ month: 12, day: 31 })).toBe(false)
    })

    it("isFiscalYearEnd returns false for non-object values", () => {
      expect(isFiscalYearEnd(null)).toBe(false)
      expect(isFiscalYearEnd(undefined)).toBe(false)
      expect(isFiscalYearEnd("December 31")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for FiscalYearEnd", () => {
      const fye1 = FiscalYearEnd.make({ month: 12, day: 31 })
      const fye2 = FiscalYearEnd.make({ month: 12, day: 31 })
      const fye3 = FiscalYearEnd.make({ month: 3, day: 31 })

      expect(Equal.equals(fye1, fye2)).toBe(true)
      expect(Equal.equals(fye1, fye3)).toBe(false)
    })
  })
})

describe("Company", () => {
  const companyUUID = "550e8400-e29b-41d4-a716-446655440000"
  const orgUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const parentCompanyUUID = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"

  const createTopLevelCompany = () => {
    return Company.make({
      id: CompanyId.make(companyUUID),
      organizationId: OrganizationId.make(orgUUID),
      name: "Acme Corporation",
      legalName: "Acme Corporation Inc.",
      jurisdiction: US,
      taxId: Option.some("12-3456789"),
      functionalCurrency: USD,
      reportingCurrency: USD,
      fiscalYearEnd: CALENDAR_YEAR_END,
      parentCompanyId: Option.none(),
      ownershipPercentage: Option.none(),
      consolidationMethod: Option.none(),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 })
    })
  }

  const createSubsidiaryCompany = () => {
    return Company.make({
      id: CompanyId.make(companyUUID),
      organizationId: OrganizationId.make(orgUUID),
      name: "Acme UK Ltd",
      legalName: "Acme UK Limited",
      jurisdiction: GB,
      taxId: Option.some("GB123456789"),
      functionalCurrency: GBP,
      reportingCurrency: USD,
      fiscalYearEnd: FISCAL_YEAR_END_MARCH,
      parentCompanyId: Option.some(CompanyId.make(parentCompanyUUID)),
      ownershipPercentage: Option.some(Percentage.make(80)),
      consolidationMethod: Option.some("FullConsolidation" as ConsolidationMethod),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 })
    })
  }

  describe("validation", () => {
    it.effect("accepts valid top-level company data", () =>
      Effect.gen(function* () {
        const company = createTopLevelCompany()
        expect(company.id).toBe(companyUUID)
        expect(company.name).toBe("Acme Corporation")
        expect(company.legalName).toBe("Acme Corporation Inc.")
        expect(company.jurisdiction).toBe(US)
        expect(Option.getOrNull(company.taxId)).toBe("12-3456789")
        expect(company.functionalCurrency).toBe(USD)
        expect(company.reportingCurrency).toBe(USD)
        expect(company.fiscalYearEnd.month).toBe(12)
        expect(company.fiscalYearEnd.day).toBe(31)
        expect(Option.isNone(company.parentCompanyId)).toBe(true)
        expect(Option.isNone(company.ownershipPercentage)).toBe(true)
        expect(Option.isNone(company.consolidationMethod)).toBe(true)
        expect(company.isActive).toBe(true)
      })
    )

    it.effect("accepts valid subsidiary company data", () =>
      Effect.gen(function* () {
        const company = createSubsidiaryCompany()
        expect(company.name).toBe("Acme UK Ltd")
        expect(company.legalName).toBe("Acme UK Limited")
        expect(company.jurisdiction).toBe(GB)
        expect(company.functionalCurrency).toBe(GBP)
        expect(company.reportingCurrency).toBe(USD)
        expect(Option.getOrNull(company.parentCompanyId)).toBe(parentCompanyUUID)
        expect(Option.getOrNull(company.ownershipPercentage)).toBe(80)
        expect(Option.getOrNull(company.consolidationMethod)).toBe("FullConsolidation")
      })
    )

    it.effect("accepts company with no tax ID", () =>
      Effect.gen(function* () {
        const company = Company.make({
          id: CompanyId.make(companyUUID),
          organizationId: OrganizationId.make(orgUUID),
          name: "No Tax ID Corp",
          legalName: "No Tax ID Corporation",
          jurisdiction: US,
          taxId: Option.none(),
          functionalCurrency: USD,
          reportingCurrency: USD,
          fiscalYearEnd: CALENDAR_YEAR_END,
          parentCompanyId: Option.none(),
          ownershipPercentage: Option.none(),
          consolidationMethod: Option.none(),
          isActive: true,
          createdAt: Timestamp.make({ epochMillis: 1718409600000 })
        })
        expect(Option.isNone(company.taxId)).toBe(true)
      })
    )

    it.effect("accepts company with different functional and reporting currencies", () =>
      Effect.gen(function* () {
        const company = Company.make({
          id: CompanyId.make(companyUUID),
          organizationId: OrganizationId.make(orgUUID),
          name: "Euro Corp",
          legalName: "Euro Corporation",
          jurisdiction: US,
          taxId: Option.none(),
          functionalCurrency: EUR,
          reportingCurrency: USD,
          fiscalYearEnd: CALENDAR_YEAR_END,
          parentCompanyId: Option.none(),
          ownershipPercentage: Option.none(),
          consolidationMethod: Option.none(),
          isActive: true,
          createdAt: Timestamp.make({ epochMillis: 1718409600000 })
        })
        expect(company.functionalCurrency).toBe(EUR)
        expect(company.reportingCurrency).toBe(USD)
      })
    )

    it.effect("accepts inactive company", () =>
      Effect.gen(function* () {
        const company = Company.make({
          id: CompanyId.make(companyUUID),
          organizationId: OrganizationId.make(orgUUID),
          name: "Inactive Corp",
          legalName: "Inactive Corporation",
          jurisdiction: US,
          taxId: Option.none(),
          functionalCurrency: USD,
          reportingCurrency: USD,
          fiscalYearEnd: CALENDAR_YEAR_END,
          parentCompanyId: Option.none(),
          ownershipPercentage: Option.none(),
          consolidationMethod: Option.none(),
          isActive: false,
          createdAt: Timestamp.make({ epochMillis: 1718409600000 })
        })
        expect(company.isActive).toBe(false)
      })
    )

    it.effect("accepts all consolidation methods", () =>
      Effect.gen(function* () {
        const methods: ConsolidationMethod[] = [
          "FullConsolidation",
          "EquityMethod",
          "CostMethod",
          "VariableInterestEntity"
        ]

        for (const method of methods) {
          const company = Company.make({
            id: CompanyId.make(companyUUID),
            organizationId: OrganizationId.make(orgUUID),
            name: `${method} Corp`,
            legalName: `${method} Corporation`,
            jurisdiction: US,
            taxId: Option.none(),
            functionalCurrency: USD,
            reportingCurrency: USD,
            fiscalYearEnd: CALENDAR_YEAR_END,
            parentCompanyId: Option.some(CompanyId.make(parentCompanyUUID)),
            ownershipPercentage: Option.some(Percentage.make(50)),
            consolidationMethod: Option.some(method),
            isActive: true,
            createdAt: Timestamp.make({ epochMillis: 1718409600000 })
          })
          expect(Option.getOrNull(company.consolidationMethod)).toBe(method)
        }
      })
    )

    it.effect("rejects empty name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Company)
        const result = yield* Effect.exit(decode({
          id: companyUUID,
          organizationId: orgUUID,
          name: "",
          legalName: "Legal Name",
          jurisdiction: "US",
          taxId: null,
          functionalCurrency: "USD",
          reportingCurrency: "USD",
          fiscalYearEnd: { month: 12, day: 31 },
          parentCompanyId: null,
          ownershipPercentage: null,
          consolidationMethod: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty legal name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Company)
        const result = yield* Effect.exit(decode({
          id: companyUUID,
          organizationId: orgUUID,
          name: "Company Name",
          legalName: "",
          jurisdiction: "US",
          taxId: null,
          functionalCurrency: "USD",
          reportingCurrency: "USD",
          fiscalYearEnd: { month: 12, day: 31 },
          parentCompanyId: null,
          ownershipPercentage: null,
          consolidationMethod: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid jurisdiction code", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Company)
        const result = yield* Effect.exit(decode({
          id: companyUUID,
          organizationId: orgUUID,
          name: "Company Name",
          legalName: "Legal Name",
          jurisdiction: "INVALID",
          taxId: null,
          functionalCurrency: "USD",
          reportingCurrency: "USD",
          fiscalYearEnd: { month: 12, day: 31 },
          parentCompanyId: null,
          ownershipPercentage: null,
          consolidationMethod: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid functional currency code", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Company)
        const result = yield* Effect.exit(decode({
          id: companyUUID,
          organizationId: orgUUID,
          name: "Company Name",
          legalName: "Legal Name",
          jurisdiction: "US",
          taxId: null,
          functionalCurrency: "INVALID",
          reportingCurrency: "USD",
          fiscalYearEnd: { month: 12, day: 31 },
          parentCompanyId: null,
          ownershipPercentage: null,
          consolidationMethod: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid reporting currency code", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Company)
        const result = yield* Effect.exit(decode({
          id: companyUUID,
          organizationId: orgUUID,
          name: "Company Name",
          legalName: "Legal Name",
          jurisdiction: "US",
          taxId: null,
          functionalCurrency: "USD",
          reportingCurrency: "INVALID",
          fiscalYearEnd: { month: 12, day: 31 },
          parentCompanyId: null,
          ownershipPercentage: null,
          consolidationMethod: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid ownership percentage", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Company)
        const result = yield* Effect.exit(decode({
          id: companyUUID,
          organizationId: orgUUID,
          name: "Company Name",
          legalName: "Legal Name",
          jurisdiction: "US",
          taxId: null,
          functionalCurrency: "USD",
          reportingCurrency: "USD",
          fiscalYearEnd: { month: 12, day: 31 },
          parentCompanyId: parentCompanyUUID,
          ownershipPercentage: 150, // Invalid - > 100
          consolidationMethod: "FullConsolidation",
          isActive: true,
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid consolidation method", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Company)
        const result = yield* Effect.exit(decode({
          id: companyUUID,
          organizationId: orgUUID,
          name: "Company Name",
          legalName: "Legal Name",
          jurisdiction: "US",
          taxId: null,
          functionalCurrency: "USD",
          reportingCurrency: "USD",
          fiscalYearEnd: { month: 12, day: 31 },
          parentCompanyId: parentCompanyUUID,
          ownershipPercentage: 80,
          consolidationMethod: "InvalidMethod",
          isActive: true,
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid company id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Company)
        const result = yield* Effect.exit(decode({
          id: "not-a-uuid",
          organizationId: orgUUID,
          name: "Company Name",
          legalName: "Legal Name",
          jurisdiction: "US",
          taxId: null,
          functionalCurrency: "USD",
          reportingCurrency: "USD",
          fiscalYearEnd: { month: 12, day: 31 },
          parentCompanyId: null,
          ownershipPercentage: null,
          consolidationMethod: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid organization id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Company)
        const result = yield* Effect.exit(decode({
          id: companyUUID,
          organizationId: "not-a-uuid",
          name: "Company Name",
          legalName: "Legal Name",
          jurisdiction: "US",
          taxId: null,
          functionalCurrency: "USD",
          reportingCurrency: "USD",
          fiscalYearEnd: { month: 12, day: 31 },
          parentCompanyId: null,
          ownershipPercentage: null,
          consolidationMethod: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("computed properties", () => {
    it("isTopLevel returns true for company without parent", () => {
      const company = createTopLevelCompany()
      expect(company.isTopLevel).toBe(true)
    })

    it("isTopLevel returns false for subsidiary", () => {
      const company = createSubsidiaryCompany()
      expect(company.isTopLevel).toBe(false)
    })

    it("isSubsidiary returns false for company without parent", () => {
      const company = createTopLevelCompany()
      expect(company.isSubsidiary).toBe(false)
    })

    it("isSubsidiary returns true for subsidiary", () => {
      const company = createSubsidiaryCompany()
      expect(company.isSubsidiary).toBe(true)
    })

    it("hasSameFunctionalAndReportingCurrency returns true when currencies match", () => {
      const company = createTopLevelCompany()
      expect(company.hasSameFunctionalAndReportingCurrency).toBe(true)
    })

    it("hasSameFunctionalAndReportingCurrency returns false when currencies differ", () => {
      const company = createSubsidiaryCompany()
      expect(company.hasSameFunctionalAndReportingCurrency).toBe(false)
    })

    it("nonControllingInterestPercentage is None for top-level company", () => {
      const company = createTopLevelCompany()
      expect(Option.isNone(company.nonControllingInterestPercentage)).toBe(true)
    })

    it("nonControllingInterestPercentage is calculated correctly for subsidiary", () => {
      const company = createSubsidiaryCompany()
      const nci = company.nonControllingInterestPercentage
      expect(Option.isSome(nci)).toBe(true)
      expect(Option.getOrNull(nci)).toBe(20) // 100 - 80 = 20%
    })

    it("nonControllingInterestPercentage is 0 for 100% owned subsidiary", () => {
      const company = Company.make({
        id: CompanyId.make(companyUUID),
        organizationId: OrganizationId.make(orgUUID),
        name: "Wholly Owned Sub",
        legalName: "Wholly Owned Subsidiary Inc.",
        jurisdiction: US,
        taxId: Option.none(),
        functionalCurrency: USD,
        reportingCurrency: USD,
        fiscalYearEnd: CALENDAR_YEAR_END,
        parentCompanyId: Option.some(CompanyId.make(parentCompanyUUID)),
        ownershipPercentage: Option.some(Percentage.make(100)),
        consolidationMethod: Option.some("FullConsolidation" as ConsolidationMethod),
        isActive: true,
        createdAt: Timestamp.make({ epochMillis: 1718409600000 })
      })
      const nci = company.nonControllingInterestPercentage
      expect(Option.isSome(nci)).toBe(true)
      expect(Option.getOrNull(nci)).toBe(0)
    })
  })

  describe("type guard", () => {
    it("isCompany returns true for Company instances", () => {
      const company = createTopLevelCompany()
      expect(isCompany(company)).toBe(true)
    })

    it("isCompany returns false for plain objects", () => {
      expect(isCompany({
        id: companyUUID,
        organizationId: orgUUID,
        name: "Test Corp",
        legalName: "Test Corporation",
        jurisdiction: "US",
        taxId: null,
        functionalCurrency: "USD",
        reportingCurrency: "USD",
        fiscalYearEnd: { month: 12, day: 31 },
        parentCompanyId: null,
        ownershipPercentage: null,
        consolidationMethod: null,
        isActive: true,
        createdAt: { epochMillis: 1718409600000 }
      })).toBe(false)
    })

    it("isCompany returns false for non-object values", () => {
      expect(isCompany(null)).toBe(false)
      expect(isCompany(undefined)).toBe(false)
      expect(isCompany("company")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for Company", () => {
      const company1 = createTopLevelCompany()
      const company2 = Company.make({
        id: CompanyId.make(companyUUID),
        organizationId: OrganizationId.make(orgUUID),
        name: "Acme Corporation",
        legalName: "Acme Corporation Inc.",
        jurisdiction: US,
        taxId: Option.some("12-3456789"),
        functionalCurrency: USD,
        reportingCurrency: USD,
        fiscalYearEnd: CALENDAR_YEAR_END,
        parentCompanyId: Option.none(),
        ownershipPercentage: Option.none(),
        consolidationMethod: Option.none(),
        isActive: true,
        createdAt: Timestamp.make({ epochMillis: 1718409600000 })
      })
      const company3 = createSubsidiaryCompany()

      expect(Equal.equals(company1, company2)).toBe(true)
      expect(Equal.equals(company1, company3)).toBe(false)
    })

    it("Equal.equals is false for different timestamps", () => {
      const company1 = createTopLevelCompany()
      const company2 = Company.make({
        id: CompanyId.make(companyUUID),
        organizationId: OrganizationId.make(orgUUID),
        name: "Acme Corporation",
        legalName: "Acme Corporation Inc.",
        jurisdiction: US,
        taxId: Option.some("12-3456789"),
        functionalCurrency: USD,
        reportingCurrency: USD,
        fiscalYearEnd: CALENDAR_YEAR_END,
        parentCompanyId: Option.none(),
        ownershipPercentage: Option.none(),
        consolidationMethod: Option.none(),
        isActive: true,
        createdAt: Timestamp.make({ epochMillis: 1718409600001 })
      })

      expect(Equal.equals(company1, company2)).toBe(false)
    })

    it("Equal.equals is false for different fiscal year end", () => {
      const company1 = createTopLevelCompany()
      const company2 = Company.make({
        id: CompanyId.make(companyUUID),
        organizationId: OrganizationId.make(orgUUID),
        name: "Acme Corporation",
        legalName: "Acme Corporation Inc.",
        jurisdiction: US,
        taxId: Option.some("12-3456789"),
        functionalCurrency: USD,
        reportingCurrency: USD,
        fiscalYearEnd: FISCAL_YEAR_END_MARCH,
        parentCompanyId: Option.none(),
        ownershipPercentage: Option.none(),
        consolidationMethod: Option.none(),
        isActive: true,
        createdAt: Timestamp.make({ epochMillis: 1718409600000 })
      })

      expect(Equal.equals(company1, company2)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes top-level Company", () =>
      Effect.gen(function* () {
        const original = createTopLevelCompany()
        const encoded = yield* Schema.encode(Company)(original)
        const decoded = yield* Schema.decodeUnknown(Company)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes subsidiary Company", () =>
      Effect.gen(function* () {
        const original = createSubsidiaryCompany()
        const encoded = yield* Schema.encode(Company)(original)
        const decoded = yield* Schema.decodeUnknown(Company)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure for top-level company", () =>
      Effect.gen(function* () {
        const company = createTopLevelCompany()
        const encoded = yield* Schema.encode(Company)(company)

        expect(encoded).toHaveProperty("id", companyUUID)
        expect(encoded).toHaveProperty("organizationId", orgUUID)
        expect(encoded).toHaveProperty("name", "Acme Corporation")
        expect(encoded).toHaveProperty("legalName", "Acme Corporation Inc.")
        expect(encoded).toHaveProperty("jurisdiction", "US")
        expect(encoded).toHaveProperty("taxId", "12-3456789")
        expect(encoded).toHaveProperty("functionalCurrency", "USD")
        expect(encoded).toHaveProperty("reportingCurrency", "USD")
        expect(encoded).toHaveProperty("fiscalYearEnd")
        expect(encoded).toHaveProperty("parentCompanyId", null)
        expect(encoded).toHaveProperty("ownershipPercentage", null)
        expect(encoded).toHaveProperty("consolidationMethod", null)
        expect(encoded).toHaveProperty("isActive", true)
        expect(encoded).toHaveProperty("createdAt")
      })
    )

    it.effect("encodes to expected JSON structure for subsidiary", () =>
      Effect.gen(function* () {
        const company = createSubsidiaryCompany()
        const encoded = yield* Schema.encode(Company)(company)

        expect(encoded).toHaveProperty("parentCompanyId", parentCompanyUUID)
        expect(encoded).toHaveProperty("ownershipPercentage", 80)
        expect(encoded).toHaveProperty("consolidationMethod", "FullConsolidation")
      })
    )
  })

  describe("immutability", () => {
    it("Company properties are readonly at compile time", () => {
      const company = createTopLevelCompany()
      expect(company.name).toBe("Acme Corporation")
    })
  })
})
