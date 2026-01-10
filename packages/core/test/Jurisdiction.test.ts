import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal } from "effect"
import * as Schema from "effect/Schema"
import {
  TaxRule,
  isTaxRule,
  TaxSettings,
  isTaxSettings,
  Jurisdiction,
  isJurisdiction,
  US_TAX_SETTINGS,
  GB_TAX_SETTINGS,
  US_JURISDICTION,
  GB_JURISDICTION,
  PREDEFINED_JURISDICTIONS,
  JURISDICTIONS_BY_CODE,
  getJurisdictionByCode
} from "../src/domain/Jurisdiction.js"
import { JurisdictionCode, US, GB } from "../src/domain/JurisdictionCode.js"
import { CurrencyCode, USD, GBP } from "../src/domain/CurrencyCode.js"

describe("TaxRule", () => {
  const createValidTaxRule = () => {
    return TaxRule.make({
      name: "Corporate Tax",
      rate: 0.21,
      isApplicable: true,
      description: "Standard corporate tax"
    })
  }

  describe("validation", () => {
    it.effect("accepts valid tax rule with all fields", () =>
      Effect.gen(function* () {
        const rule = createValidTaxRule()
        expect(rule.name).toBe("Corporate Tax")
        expect(rule.rate).toBe(0.21)
        expect(rule.isApplicable).toBe(true)
        expect(rule.description).toBe("Standard corporate tax")
      })
    )

    it.effect("accepts valid tax rule without description", () =>
      Effect.gen(function* () {
        const rule = TaxRule.make({
          name: "Sales Tax",
          rate: 0.08,
          isApplicable: false
        })
        expect(rule.name).toBe("Sales Tax")
        expect(rule.rate).toBe(0.08)
        expect(rule.isApplicable).toBe(false)
        expect(rule.description).toBeUndefined()
      })
    )

    it.effect("accepts rate of 0", () =>
      Effect.gen(function* () {
        const rule = TaxRule.make({
          name: "Zero Tax",
          rate: 0,
          isApplicable: true
        })
        expect(rule.rate).toBe(0)
      })
    )

    it.effect("accepts rate of 1 (100%)", () =>
      Effect.gen(function* () {
        const rule = TaxRule.make({
          name: "Full Tax",
          rate: 1,
          isApplicable: true
        })
        expect(rule.rate).toBe(1)
      })
    )

    it.effect("accepts rate of 0.5 (50%)", () =>
      Effect.gen(function* () {
        const rule = TaxRule.make({
          name: "Half Tax",
          rate: 0.5,
          isApplicable: true
        })
        expect(rule.rate).toBe(0.5)
      })
    )

    it.effect("rejects empty name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxRule)
        const result = yield* Effect.exit(decode({
          name: "",
          rate: 0.21,
          isApplicable: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects whitespace-only name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxRule)
        const result = yield* Effect.exit(decode({
          name: "   ",
          rate: 0.21,
          isApplicable: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects negative rate", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxRule)
        const result = yield* Effect.exit(decode({
          name: "Invalid Tax",
          rate: -0.1,
          isApplicable: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects rate greater than 1", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxRule)
        const result = yield* Effect.exit(decode({
          name: "Invalid Tax",
          rate: 1.5,
          isApplicable: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects missing required fields", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxRule)
        const result = yield* Effect.exit(decode({
          name: "Tax"
          // Missing rate and isApplicable
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty description", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxRule)
        const result = yield* Effect.exit(decode({
          name: "Tax",
          rate: 0.21,
          isApplicable: true,
          description: ""
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-boolean isApplicable", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxRule)
        const result = yield* Effect.exit(decode({
          name: "Tax",
          rate: 0.21,
          isApplicable: "true"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-number rate", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxRule)
        const result = yield* Effect.exit(decode({
          name: "Tax",
          rate: "0.21",
          isApplicable: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isTaxRule returns true for valid TaxRule", () => {
      const rule = createValidTaxRule()
      expect(isTaxRule(rule)).toBe(true)
    })

    it("isTaxRule returns false for plain objects (Schema.Class behavior)", () => {
      // Schema.Class type guards return false for plain objects
      expect(isTaxRule({
        name: "Tax",
        rate: 0.21,
        isApplicable: true
      })).toBe(false)
    })

    it("isTaxRule returns false for non-object values", () => {
      expect(isTaxRule(null)).toBe(false)
      expect(isTaxRule(undefined)).toBe(false)
      expect(isTaxRule("taxRule")).toBe(false)
    })
  })
})

describe("TaxSettings", () => {
  const createValidTaxSettings = () => {
    return TaxSettings.make({
      taxRules: [
        TaxRule.make({
          name: "Income Tax",
          rate: 0.21,
          isApplicable: true
        })
      ],
      defaultFiscalYearEndMonth: 12,
      hasVat: false,
      hasWithholdingTax: true
    })
  }

  describe("validation", () => {
    it.effect("accepts valid tax settings", () =>
      Effect.gen(function* () {
        const settings = createValidTaxSettings()
        expect(settings.taxRules.length).toBe(1)
        expect(settings.defaultFiscalYearEndMonth).toBe(12)
        expect(settings.hasVat).toBe(false)
        expect(settings.hasWithholdingTax).toBe(true)
      })
    )

    it.effect("accepts empty tax rules array", () =>
      Effect.gen(function* () {
        const settings = TaxSettings.make({
          taxRules: [],
          defaultFiscalYearEndMonth: 6,
          hasVat: true,
          hasWithholdingTax: false
        })
        expect(settings.taxRules.length).toBe(0)
      })
    )

    it.effect("accepts multiple tax rules", () =>
      Effect.gen(function* () {
        const settings = TaxSettings.make({
          taxRules: [
            TaxRule.make({ name: "Tax 1", rate: 0.1, isApplicable: true }),
            TaxRule.make({ name: "Tax 2", rate: 0.2, isApplicable: false }),
            TaxRule.make({ name: "Tax 3", rate: 0.05, isApplicable: true })
          ],
          defaultFiscalYearEndMonth: 3,
          hasVat: true,
          hasWithholdingTax: true
        })
        expect(settings.taxRules.length).toBe(3)
      })
    )

    it.effect("accepts fiscal year end month 1 (January)", () =>
      Effect.gen(function* () {
        const settings = TaxSettings.make({
          taxRules: [],
          defaultFiscalYearEndMonth: 1,
          hasVat: false,
          hasWithholdingTax: false
        })
        expect(settings.defaultFiscalYearEndMonth).toBe(1)
      })
    )

    it.effect("accepts fiscal year end month 12 (December)", () =>
      Effect.gen(function* () {
        const settings = TaxSettings.make({
          taxRules: [],
          defaultFiscalYearEndMonth: 12,
          hasVat: false,
          hasWithholdingTax: false
        })
        expect(settings.defaultFiscalYearEndMonth).toBe(12)
      })
    )

    it.effect("rejects fiscal year end month 0", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxSettings)
        const result = yield* Effect.exit(decode({
          taxRules: [],
          defaultFiscalYearEndMonth: 0,
          hasVat: false,
          hasWithholdingTax: false
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects fiscal year end month 13", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxSettings)
        const result = yield* Effect.exit(decode({
          taxRules: [],
          defaultFiscalYearEndMonth: 13,
          hasVat: false,
          hasWithholdingTax: false
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-integer fiscal year end month", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxSettings)
        const result = yield* Effect.exit(decode({
          taxRules: [],
          defaultFiscalYearEndMonth: 6.5,
          hasVat: false,
          hasWithholdingTax: false
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects missing required fields", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxSettings)
        const result = yield* Effect.exit(decode({
          taxRules: []
          // Missing defaultFiscalYearEndMonth, hasVat, hasWithholdingTax
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid tax rule in array", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TaxSettings)
        const result = yield* Effect.exit(decode({
          taxRules: [
            { name: "Valid Tax", rate: 0.1, isApplicable: true },
            { name: "", rate: 0.2, isApplicable: false } // Invalid: empty name
          ],
          defaultFiscalYearEndMonth: 12,
          hasVat: false,
          hasWithholdingTax: false
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isTaxSettings returns true for valid TaxSettings", () => {
      const settings = createValidTaxSettings()
      expect(isTaxSettings(settings)).toBe(true)
    })

    it("isTaxSettings returns false for plain objects (Schema.Class behavior)", () => {
      // Schema.Class type guards return false for plain objects
      expect(isTaxSettings({
        taxRules: [],
        defaultFiscalYearEndMonth: 12,
        hasVat: false,
        hasWithholdingTax: true
      })).toBe(false)
    })

    it("isTaxSettings returns false for non-object values", () => {
      expect(isTaxSettings(null)).toBe(false)
      expect(isTaxSettings(undefined)).toBe(false)
      expect(isTaxSettings("settings")).toBe(false)
    })
  })
})

describe("Jurisdiction", () => {
  const createValidJurisdiction = () => {
    return Jurisdiction.make({
      code: JurisdictionCode.make("US"),
      name: "United States",
      defaultCurrency: CurrencyCode.make("USD"),
      taxSettings: TaxSettings.make({
        taxRules: [
          TaxRule.make({ name: "Federal Tax", rate: 0.21, isApplicable: true })
        ],
        defaultFiscalYearEndMonth: 12,
        hasVat: false,
        hasWithholdingTax: true
      })
    })
  }

  describe("validation", () => {
    it.effect("accepts valid jurisdiction", () =>
      Effect.gen(function* () {
        const jurisdiction = createValidJurisdiction()
        expect(jurisdiction.code).toBe("US")
        expect(jurisdiction.name).toBe("United States")
        expect(jurisdiction.defaultCurrency).toBe("USD")
        expect(jurisdiction.taxSettings.taxRules.length).toBe(1)
      })
    )

    it.effect("accepts jurisdiction with multiple tax rules", () =>
      Effect.gen(function* () {
        const jurisdiction = Jurisdiction.make({
          code: JurisdictionCode.make("GB"),
          name: "United Kingdom",
          defaultCurrency: CurrencyCode.make("GBP"),
          taxSettings: TaxSettings.make({
            taxRules: [
              TaxRule.make({ name: "Corporation Tax", rate: 0.25, isApplicable: true }),
              TaxRule.make({ name: "VAT", rate: 0.2, isApplicable: true })
            ],
            defaultFiscalYearEndMonth: 4,
            hasVat: true,
            hasWithholdingTax: true
          })
        })
        expect(jurisdiction.taxSettings.taxRules.length).toBe(2)
      })
    )

    it.effect("accepts jurisdiction with empty tax rules", () =>
      Effect.gen(function* () {
        const jurisdiction = Jurisdiction.make({
          code: JurisdictionCode.make("CA"),
          name: "Canada",
          defaultCurrency: CurrencyCode.make("CAD"),
          taxSettings: TaxSettings.make({
            taxRules: [],
            defaultFiscalYearEndMonth: 12,
            hasVat: true,
            hasWithholdingTax: false
          })
        })
        expect(jurisdiction.taxSettings.taxRules.length).toBe(0)
      })
    )

    it.effect("rejects invalid jurisdiction code", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Jurisdiction)
        const result = yield* Effect.exit(decode({
          code: "INVALID",
          name: "Invalid",
          defaultCurrency: "USD",
          taxSettings: {
            taxRules: [],
            defaultFiscalYearEndMonth: 12,
            hasVat: false,
            hasWithholdingTax: false
          }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid currency code", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Jurisdiction)
        const result = yield* Effect.exit(decode({
          code: "US",
          name: "United States",
          defaultCurrency: "INVALID",
          taxSettings: {
            taxRules: [],
            defaultFiscalYearEndMonth: 12,
            hasVat: false,
            hasWithholdingTax: false
          }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Jurisdiction)
        const result = yield* Effect.exit(decode({
          code: "US",
          name: "",
          defaultCurrency: "USD",
          taxSettings: {
            taxRules: [],
            defaultFiscalYearEndMonth: 12,
            hasVat: false,
            hasWithholdingTax: false
          }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects whitespace-only name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Jurisdiction)
        const result = yield* Effect.exit(decode({
          code: "US",
          name: "   ",
          defaultCurrency: "USD",
          taxSettings: {
            taxRules: [],
            defaultFiscalYearEndMonth: 12,
            hasVat: false,
            hasWithholdingTax: false
          }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid tax settings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Jurisdiction)
        const result = yield* Effect.exit(decode({
          code: "US",
          name: "United States",
          defaultCurrency: "USD",
          taxSettings: {
            taxRules: [],
            defaultFiscalYearEndMonth: 13, // Invalid
            hasVat: false,
            hasWithholdingTax: false
          }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects missing required fields", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Jurisdiction)
        const result = yield* Effect.exit(decode({
          code: "US"
          // Missing name, defaultCurrency, taxSettings
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isJurisdiction returns true for Jurisdiction instances", () => {
      const jurisdiction = createValidJurisdiction()
      expect(isJurisdiction(jurisdiction)).toBe(true)
    })

    it("isJurisdiction returns false for plain objects", () => {
      expect(isJurisdiction({
        code: "US",
        name: "United States",
        defaultCurrency: "USD",
        taxSettings: {}
      })).toBe(false)
    })

    it("isJurisdiction returns false for non-object values", () => {
      expect(isJurisdiction(null)).toBe(false)
      expect(isJurisdiction(undefined)).toBe(false)
      expect(isJurisdiction("jurisdiction")).toBe(false)
    })
  })

  describe("totalApplicableTaxRate getter", () => {
    it("calculates total from applicable taxes", () => {
      const jurisdiction = Jurisdiction.make({
        code: JurisdictionCode.make("GB"),
        name: "United Kingdom",
        defaultCurrency: CurrencyCode.make("GBP"),
        taxSettings: TaxSettings.make({
          taxRules: [
            TaxRule.make({ name: "Tax 1", rate: 0.25, isApplicable: true }),
            TaxRule.make({ name: "Tax 2", rate: 0.2, isApplicable: true }),
            TaxRule.make({ name: "Tax 3", rate: 0.1, isApplicable: false }) // Not applicable
          ],
          defaultFiscalYearEndMonth: 4,
          hasVat: true,
          hasWithholdingTax: true
        })
      })
      expect(jurisdiction.totalApplicableTaxRate).toBe(0.45)
    })

    it("returns 0 when no taxes are applicable", () => {
      const jurisdiction = Jurisdiction.make({
        code: JurisdictionCode.make("CA"),
        name: "Canada",
        defaultCurrency: CurrencyCode.make("CAD"),
        taxSettings: TaxSettings.make({
          taxRules: [
            TaxRule.make({ name: "Tax 1", rate: 0.1, isApplicable: false }),
            TaxRule.make({ name: "Tax 2", rate: 0.2, isApplicable: false })
          ],
          defaultFiscalYearEndMonth: 12,
          hasVat: false,
          hasWithholdingTax: false
        })
      })
      expect(jurisdiction.totalApplicableTaxRate).toBe(0)
    })

    it("returns 0 when no tax rules exist", () => {
      const jurisdiction = Jurisdiction.make({
        code: JurisdictionCode.make("AU"),
        name: "Australia",
        defaultCurrency: CurrencyCode.make("AUD"),
        taxSettings: TaxSettings.make({
          taxRules: [],
          defaultFiscalYearEndMonth: 6,
          hasVat: true,
          hasWithholdingTax: false
        })
      })
      expect(jurisdiction.totalApplicableTaxRate).toBe(0)
    })
  })

  describe("applicableTaxNames getter", () => {
    it("returns names of applicable taxes only", () => {
      const jurisdiction = Jurisdiction.make({
        code: JurisdictionCode.make("GB"),
        name: "United Kingdom",
        defaultCurrency: CurrencyCode.make("GBP"),
        taxSettings: TaxSettings.make({
          taxRules: [
            TaxRule.make({ name: "Corporation Tax", rate: 0.25, isApplicable: true }),
            TaxRule.make({ name: "VAT", rate: 0.2, isApplicable: true }),
            TaxRule.make({ name: "Stamp Duty", rate: 0.05, isApplicable: false })
          ],
          defaultFiscalYearEndMonth: 4,
          hasVat: true,
          hasWithholdingTax: true
        })
      })
      expect(jurisdiction.applicableTaxNames).toEqual(["Corporation Tax", "VAT"])
    })

    it("returns empty array when no taxes are applicable", () => {
      const jurisdiction = Jurisdiction.make({
        code: JurisdictionCode.make("SG"),
        name: "Singapore",
        defaultCurrency: CurrencyCode.make("SGD"),
        taxSettings: TaxSettings.make({
          taxRules: [
            TaxRule.make({ name: "Tax", rate: 0.1, isApplicable: false })
          ],
          defaultFiscalYearEndMonth: 12,
          hasVat: false,
          hasWithholdingTax: false
        })
      })
      expect(jurisdiction.applicableTaxNames).toEqual([])
    })

    it("returns empty array when no tax rules exist", () => {
      const jurisdiction = Jurisdiction.make({
        code: JurisdictionCode.make("HK"),
        name: "Hong Kong",
        defaultCurrency: CurrencyCode.make("HKD"),
        taxSettings: TaxSettings.make({
          taxRules: [],
          defaultFiscalYearEndMonth: 3,
          hasVat: false,
          hasWithholdingTax: false
        })
      })
      expect(jurisdiction.applicableTaxNames).toEqual([])
    })
  })

  describe("equality", () => {
    it("Equal.equals returns true for same Jurisdiction reference", () => {
      const jurisdiction = createValidJurisdiction()
      expect(Equal.equals(jurisdiction, jurisdiction)).toBe(true)
    })

    it("Equal.equals returns false for different Jurisdiction instances", () => {
      // Note: Schema.Class equality with nested objects/arrays compares by reference
      // Different instances of Jurisdiction will not be Equal even if structurally the same
      const jurisdiction1 = createValidJurisdiction()
      const jurisdiction2 = createValidJurisdiction()

      // These are different object instances, so Equal.equals returns false
      expect(Equal.equals(jurisdiction1, jurisdiction2)).toBe(false)
    })

    it("Equal.equals is false for different names", () => {
      const jurisdiction1 = createValidJurisdiction()
      const jurisdiction2 = Jurisdiction.make({
        code: JurisdictionCode.make("US"),
        name: "USA",
        defaultCurrency: CurrencyCode.make("USD"),
        taxSettings: TaxSettings.make({
          taxRules: [
            TaxRule.make({ name: "Federal Tax", rate: 0.21, isApplicable: true })
          ],
          defaultFiscalYearEndMonth: 12,
          hasVat: false,
          hasWithholdingTax: true
        })
      })

      expect(Equal.equals(jurisdiction1, jurisdiction2)).toBe(false)
    })

    it("Equal.equals is false for different tax settings", () => {
      const jurisdiction1 = createValidJurisdiction()
      const jurisdiction2 = Jurisdiction.make({
        code: JurisdictionCode.make("US"),
        name: "United States",
        defaultCurrency: CurrencyCode.make("USD"),
        taxSettings: TaxSettings.make({
          taxRules: [
            TaxRule.make({ name: "Federal Tax", rate: 0.25, isApplicable: true }) // Different rate
          ],
          defaultFiscalYearEndMonth: 12,
          hasVat: false,
          hasWithholdingTax: true
        })
      })

      expect(Equal.equals(jurisdiction1, jurisdiction2)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes Jurisdiction", () =>
      Effect.gen(function* () {
        const original = createValidJurisdiction()
        const encoded = yield* Schema.encode(Jurisdiction)(original)
        const decoded = yield* Schema.decodeUnknown(Jurisdiction)(encoded)

        // Verify structural equality for decoded jurisdiction
        expect(decoded.code).toBe(original.code)
        expect(decoded.name).toBe(original.name)
        expect(decoded.defaultCurrency).toBe(original.defaultCurrency)
        expect(decoded.taxSettings.defaultFiscalYearEndMonth).toBe(original.taxSettings.defaultFiscalYearEndMonth)
        expect(decoded.taxSettings.hasVat).toBe(original.taxSettings.hasVat)
        expect(decoded.taxSettings.hasWithholdingTax).toBe(original.taxSettings.hasWithholdingTax)
        expect(decoded.taxSettings.taxRules.length).toBe(original.taxSettings.taxRules.length)
        expect(decoded.taxSettings.taxRules[0].name).toBe(original.taxSettings.taxRules[0].name)
        expect(decoded.taxSettings.taxRules[0].rate).toBe(original.taxSettings.taxRules[0].rate)
        expect(decoded.taxSettings.taxRules[0].isApplicable).toBe(original.taxSettings.taxRules[0].isApplicable)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const jurisdiction = createValidJurisdiction()
        const encoded = yield* Schema.encode(Jurisdiction)(jurisdiction)

        expect(encoded).toHaveProperty("code", "US")
        expect(encoded).toHaveProperty("name", "United States")
        expect(encoded).toHaveProperty("defaultCurrency", "USD")
        expect(encoded).toHaveProperty("taxSettings")
        expect((encoded as unknown as { taxSettings: { taxRules: unknown[] } }).taxSettings.taxRules.length).toBe(1)
      })
    )
  })

  describe("immutability", () => {
    it("Jurisdiction properties are readonly at compile time", () => {
      const jurisdiction = createValidJurisdiction()
      // TypeScript enforces immutability - no runtime check needed
      expect(jurisdiction.name).toBe("United States")
    })
  })
})

describe("Predefined Tax Settings", () => {
  describe("US_TAX_SETTINGS", () => {
    it("has correct structure", () => {
      expect(US_TAX_SETTINGS.defaultFiscalYearEndMonth).toBe(12)
      expect(US_TAX_SETTINGS.hasVat).toBe(false)
      expect(US_TAX_SETTINGS.hasWithholdingTax).toBe(true)
    })

    it("has federal corporate income tax rule", () => {
      const federalTax = US_TAX_SETTINGS.taxRules.find(
        (r) => r.name === "Federal Corporate Income Tax"
      )
      expect(federalTax).toBeDefined()
      expect(federalTax?.rate).toBe(0.21)
      expect(federalTax?.isApplicable).toBe(true)
    })

    it("has state income tax rule (not applicable by default)", () => {
      const stateTax = US_TAX_SETTINGS.taxRules.find(
        (r) => r.name === "State Income Tax"
      )
      expect(stateTax).toBeDefined()
      expect(stateTax?.isApplicable).toBe(false)
    })

    it("has sales tax rule (not applicable by default)", () => {
      const salesTax = US_TAX_SETTINGS.taxRules.find(
        (r) => r.name === "Sales Tax"
      )
      expect(salesTax).toBeDefined()
      expect(salesTax?.isApplicable).toBe(false)
    })

    it("is valid TaxSettings", () => {
      expect(isTaxSettings(US_TAX_SETTINGS)).toBe(true)
    })
  })

  describe("GB_TAX_SETTINGS", () => {
    it("has correct structure", () => {
      expect(GB_TAX_SETTINGS.defaultFiscalYearEndMonth).toBe(4)
      expect(GB_TAX_SETTINGS.hasVat).toBe(true)
      expect(GB_TAX_SETTINGS.hasWithholdingTax).toBe(true)
    })

    it("has corporation tax rule", () => {
      const corpTax = GB_TAX_SETTINGS.taxRules.find(
        (r) => r.name === "Corporation Tax"
      )
      expect(corpTax).toBeDefined()
      expect(corpTax?.rate).toBe(0.25)
      expect(corpTax?.isApplicable).toBe(true)
    })

    it("has VAT rule", () => {
      const vat = GB_TAX_SETTINGS.taxRules.find(
        (r) => r.name === "Value Added Tax (VAT)"
      )
      expect(vat).toBeDefined()
      expect(vat?.rate).toBe(0.2)
      expect(vat?.isApplicable).toBe(true)
    })

    it("is valid TaxSettings", () => {
      expect(isTaxSettings(GB_TAX_SETTINGS)).toBe(true)
    })
  })
})

describe("Predefined Jurisdictions", () => {
  describe("US_JURISDICTION", () => {
    it("has correct properties", () => {
      expect(US_JURISDICTION.code).toBe("US")
      expect(US_JURISDICTION.name).toBe("United States")
      expect(US_JURISDICTION.defaultCurrency).toBe("USD")
    })

    it("has US tax settings", () => {
      expect(US_JURISDICTION.taxSettings.defaultFiscalYearEndMonth).toBe(12)
      expect(US_JURISDICTION.taxSettings.hasVat).toBe(false)
    })

    it("is valid Jurisdiction", () => {
      expect(isJurisdiction(US_JURISDICTION)).toBe(true)
    })

    it("calculates total applicable tax rate correctly", () => {
      // US has 21% federal tax applicable by default
      expect(US_JURISDICTION.totalApplicableTaxRate).toBe(0.21)
    })

    it("returns applicable tax names correctly", () => {
      expect(US_JURISDICTION.applicableTaxNames).toContain("Federal Corporate Income Tax")
    })
  })

  describe("GB_JURISDICTION", () => {
    it("has correct properties", () => {
      expect(GB_JURISDICTION.code).toBe("GB")
      expect(GB_JURISDICTION.name).toBe("United Kingdom")
      expect(GB_JURISDICTION.defaultCurrency).toBe("GBP")
    })

    it("has GB tax settings", () => {
      expect(GB_JURISDICTION.taxSettings.defaultFiscalYearEndMonth).toBe(4)
      expect(GB_JURISDICTION.taxSettings.hasVat).toBe(true)
    })

    it("is valid Jurisdiction", () => {
      expect(isJurisdiction(GB_JURISDICTION)).toBe(true)
    })

    it("calculates total applicable tax rate correctly", () => {
      // GB has 25% corp tax + 20% VAT = 45%
      expect(GB_JURISDICTION.totalApplicableTaxRate).toBe(0.45)
    })

    it("returns applicable tax names correctly", () => {
      expect(GB_JURISDICTION.applicableTaxNames).toContain("Corporation Tax")
      expect(GB_JURISDICTION.applicableTaxNames).toContain("Value Added Tax (VAT)")
    })
  })

  describe("PREDEFINED_JURISDICTIONS", () => {
    it("contains US and GB jurisdictions", () => {
      expect(PREDEFINED_JURISDICTIONS.length).toBe(2)
      expect(PREDEFINED_JURISDICTIONS).toContain(US_JURISDICTION)
      expect(PREDEFINED_JURISDICTIONS).toContain(GB_JURISDICTION)
    })

    it("all jurisdictions are valid Jurisdiction instances", () => {
      for (const jurisdiction of PREDEFINED_JURISDICTIONS) {
        expect(isJurisdiction(jurisdiction)).toBe(true)
      }
    })
  })

  describe("JURISDICTIONS_BY_CODE", () => {
    it("provides lookup by jurisdiction code", () => {
      expect(JURISDICTIONS_BY_CODE.get(US)).toBe(US_JURISDICTION)
      expect(JURISDICTIONS_BY_CODE.get(GB)).toBe(GB_JURISDICTION)
    })

    it("returns undefined for unknown jurisdiction codes", () => {
      expect(JURISDICTIONS_BY_CODE.get(JurisdictionCode.make("CA"))).toBeUndefined()
    })

    it("has the same size as PREDEFINED_JURISDICTIONS", () => {
      expect(JURISDICTIONS_BY_CODE.size).toBe(PREDEFINED_JURISDICTIONS.length)
    })
  })

  describe("getJurisdictionByCode", () => {
    it("returns jurisdiction for known codes", () => {
      expect(getJurisdictionByCode(US)).toBe(US_JURISDICTION)
      expect(getJurisdictionByCode(GB)).toBe(GB_JURISDICTION)
    })

    it("returns undefined for unknown codes", () => {
      expect(getJurisdictionByCode(JurisdictionCode.make("CA"))).toBeUndefined()
      expect(getJurisdictionByCode(JurisdictionCode.make("AU"))).toBeUndefined()
    })
  })
})

describe("Jurisdiction with referenced types", () => {
  it("works with predefined JurisdictionCode constants", () => {
    const jurisdiction = Jurisdiction.make({
      code: US,
      name: "United States",
      defaultCurrency: USD,
      taxSettings: US_TAX_SETTINGS
    })
    expect(jurisdiction.code).toBe("US")
    expect(jurisdiction.defaultCurrency).toBe("USD")
  })

  it("works with predefined CurrencyCode constants", () => {
    const jurisdiction = Jurisdiction.make({
      code: GB,
      name: "United Kingdom",
      defaultCurrency: GBP,
      taxSettings: GB_TAX_SETTINGS
    })
    expect(jurisdiction.defaultCurrency).toBe("GBP")
  })
})
