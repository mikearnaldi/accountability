/**
 * Jurisdiction - Entity representing a legal and tax environment
 *
 * Defines the legal and tax environment for a company with country code,
 * name, default currency, and jurisdiction-specific tax settings.
 *
 * @module jurisdiction/Jurisdiction
 */

import * as Schema from "effect/Schema"
import * as Chunk from "effect/Chunk"
import { JurisdictionCode, US, GB, CA, AU, DE, FR, JP, SG, HK, CH, NL, IE } from "./JurisdictionCode.ts"
import { CurrencyCode, USD, GBP, CAD, AUD, EUR, JPY, SGD, HKD, CHF } from "../currency/CurrencyCode.ts"

// =============================================================================
// TaxSettings - Configurable tax rules for a jurisdiction
// =============================================================================

/**
 * TaxRate - Validated tax rate as a decimal (0-1)
 */
export const TaxRate = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
  Schema.annotations({
    identifier: "TaxRate",
    title: "Tax Rate",
    description: "The tax rate as a decimal (0-1)"
  })
)

/**
 * The TaxRate type
 */
export type TaxRate = typeof TaxRate.Type

/**
 * Type guard for TaxRate
 */
export const isTaxRate = Schema.is(TaxRate)

/**
 * TaxRule - A single tax rule within tax settings
 *
 * Represents a configurable tax rule with name, rate, and applicability.
 * Uses Schema.Class for proper equality and constructor support.
 */
export class TaxRule extends Schema.Class<TaxRule>("TaxRule")({
  /**
   * Name of the tax (e.g., "Federal Income Tax", "VAT")
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Tax Name",
    description: "The name of the tax rule"
  }),

  /**
   * Tax rate as a decimal (e.g., 0.21 for 21%)
   */
  rate: TaxRate,

  /**
   * Whether this tax is currently applicable
   */
  isApplicable: Schema.Boolean.annotations({
    title: "Is Applicable",
    description: "Whether this tax rule is currently applicable"
  }),

  /**
   * Optional description providing additional details about the tax
   */
  description: Schema.optional(Schema.NonEmptyTrimmedString).annotations({
    title: "Description",
    description: "Optional description of the tax rule"
  })
}) {
  /**
   * Format the rate as a percentage string (e.g., "21%")
   */
  formatRateAsPercentage(): string {
    return `${(this.rate * 100).toFixed(0)}%`
  }
}

/**
 * Type guard for TaxRule using Schema.is
 */
export const isTaxRule = Schema.is(TaxRule)

/**
 * FiscalYearEndMonth - Valid month number (1-12)
 */
export const FiscalYearEndMonth = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(12),
  Schema.annotations({
    identifier: "FiscalYearEndMonth",
    title: "Fiscal Year End Month",
    description: "The month for fiscal year end (1-12)"
  })
)

/**
 * The FiscalYearEndMonth type
 */
export type FiscalYearEndMonth = typeof FiscalYearEndMonth.Type

/**
 * Type guard for FiscalYearEndMonth
 */
export const isFiscalYearEndMonth = Schema.is(FiscalYearEndMonth)

/**
 * TaxSettings - Collection of tax rules and settings for a jurisdiction
 *
 * Contains fiscal year settings and a collection of applicable tax rules.
 * Uses Schema.Class for proper equality and constructor support.
 */
export class TaxSettings extends Schema.Class<TaxSettings>("TaxSettings")({
  /**
   * Collection of tax rules applicable in this jurisdiction
   * Uses Chunk for proper structural equality with Equal.equals
   */
  taxRules: Schema.Chunk(TaxRule).annotations({
    title: "Tax Rules",
    description: "Collection of tax rules applicable in this jurisdiction"
  }),

  /**
   * Default fiscal year end month (1-12)
   */
  defaultFiscalYearEndMonth: FiscalYearEndMonth,

  /**
   * Whether VAT/GST is applicable in this jurisdiction
   */
  hasVat: Schema.Boolean.annotations({
    title: "Has VAT",
    description: "Whether VAT/GST is applicable in this jurisdiction"
  }),

  /**
   * Whether withholding tax applies to certain payments
   */
  hasWithholdingTax: Schema.Boolean.annotations({
    title: "Has Withholding Tax",
    description: "Whether withholding tax applies to certain payments"
  })
}) {
  /**
   * Get the total applicable tax rate from all active tax rules
   */
  get totalApplicableTaxRate(): number {
    return Chunk.reduce(
      Chunk.filter(this.taxRules, (rule) => rule.isApplicable),
      0,
      (sum, rule) => sum + rule.rate
    )
  }

  /**
   * Get the names of all applicable taxes
   */
  get applicableTaxNames(): Chunk.Chunk<string> {
    return Chunk.map(
      Chunk.filter(this.taxRules, (rule) => rule.isApplicable),
      (rule) => rule.name
    )
  }
}

/**
 * Type guard for TaxSettings using Schema.is
 */
export const isTaxSettings = Schema.is(TaxSettings)

// =============================================================================
// Jurisdiction Entity
// =============================================================================

/**
 * Jurisdiction - Entity representing a legal and tax environment
 *
 * Contains the ISO 3166-1 alpha-2 country code, country name,
 * default currency for the jurisdiction, and tax settings.
 */
export class Jurisdiction extends Schema.Class<Jurisdiction>("Jurisdiction")({
  /**
   * ISO 3166-1 alpha-2 country code (e.g., US, GB)
   */
  code: JurisdictionCode,

  /**
   * Country/jurisdiction name (e.g., "United States", "United Kingdom")
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Jurisdiction Name",
    description: "The display name of the jurisdiction"
  }),

  /**
   * Default currency for this jurisdiction
   */
  defaultCurrency: CurrencyCode,

  /**
   * Tax settings for this jurisdiction
   */
  taxSettings: TaxSettings
}) {
  /**
   * Get the total applicable tax rate from all active tax rules
   * Delegates to the TaxSettings class method
   */
  get totalApplicableTaxRate(): number {
    return this.taxSettings.totalApplicableTaxRate
  }

  /**
   * Get the names of all applicable taxes
   * Delegates to the TaxSettings class method
   */
  get applicableTaxNames(): Chunk.Chunk<string> {
    return this.taxSettings.applicableTaxNames
  }
}

/**
 * Type guard for Jurisdiction using Schema.is
 */
export const isJurisdiction = Schema.is(Jurisdiction)

// =============================================================================
// Predefined Jurisdictions
// =============================================================================

/**
 * Tax settings for United States
 */
export const US_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Federal Corporate Income Tax",
      rate: 0.21,
      isApplicable: true,
      description: "Standard federal corporate income tax rate"
    }),
    TaxRule.make({
      name: "State Income Tax",
      rate: 0,
      isApplicable: false,
      description: "State-level income tax (varies by state)"
    }),
    TaxRule.make({
      name: "Sales Tax",
      rate: 0,
      isApplicable: false,
      description: "State/local sales tax (varies by jurisdiction)"
    })
  ),
  defaultFiscalYearEndMonth: 12,
  hasVat: false,
  hasWithholdingTax: true
})

/**
 * Tax settings for United Kingdom
 */
export const GB_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Corporation Tax",
      rate: 0.25,
      isApplicable: true,
      description: "UK corporation tax for profits over £250,000"
    }),
    TaxRule.make({
      name: "Value Added Tax (VAT)",
      rate: 0.2,
      isApplicable: true,
      description: "Standard VAT rate in the UK"
    })
  ),
  defaultFiscalYearEndMonth: 4,
  hasVat: true,
  hasWithholdingTax: true
})

/**
 * United States jurisdiction
 */
export const US_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: US,
  name: "United States",
  defaultCurrency: USD,
  taxSettings: US_TAX_SETTINGS
})

/**
 * United Kingdom jurisdiction
 */
export const GB_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: GB,
  name: "United Kingdom",
  defaultCurrency: GBP,
  taxSettings: GB_TAX_SETTINGS
})

/**
 * Tax settings for Canada
 */
export const CA_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Federal Corporate Income Tax",
      rate: 0.15,
      isApplicable: true,
      description: "Federal corporate income tax rate"
    }),
    TaxRule.make({
      name: "Goods and Services Tax (GST)",
      rate: 0.05,
      isApplicable: true,
      description: "Federal GST rate"
    })
  ),
  defaultFiscalYearEndMonth: 12,
  hasVat: true,
  hasWithholdingTax: true
})

/**
 * Canada jurisdiction
 */
export const CA_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: CA,
  name: "Canada",
  defaultCurrency: CAD,
  taxSettings: CA_TAX_SETTINGS
})

/**
 * Tax settings for Australia
 */
export const AU_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Corporate Income Tax",
      rate: 0.30,
      isApplicable: true,
      description: "Standard corporate tax rate"
    }),
    TaxRule.make({
      name: "Goods and Services Tax (GST)",
      rate: 0.10,
      isApplicable: true,
      description: "Australian GST rate"
    })
  ),
  defaultFiscalYearEndMonth: 6,
  hasVat: true,
  hasWithholdingTax: true
})

/**
 * Australia jurisdiction
 */
export const AU_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: AU,
  name: "Australia",
  defaultCurrency: AUD,
  taxSettings: AU_TAX_SETTINGS
})

/**
 * Tax settings for Germany
 */
export const DE_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Corporate Income Tax (Körperschaftsteuer)",
      rate: 0.15,
      isApplicable: true,
      description: "German corporate income tax"
    }),
    TaxRule.make({
      name: "Solidarity Surcharge",
      rate: 0.055,
      isApplicable: true,
      description: "5.5% surcharge on corporate tax"
    }),
    TaxRule.make({
      name: "Value Added Tax (Mehrwertsteuer)",
      rate: 0.19,
      isApplicable: true,
      description: "Standard VAT rate"
    })
  ),
  defaultFiscalYearEndMonth: 12,
  hasVat: true,
  hasWithholdingTax: true
})

/**
 * Germany jurisdiction
 */
export const DE_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: DE,
  name: "Germany",
  defaultCurrency: EUR,
  taxSettings: DE_TAX_SETTINGS
})

/**
 * Tax settings for France
 */
export const FR_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Corporate Income Tax (Impôt sur les sociétés)",
      rate: 0.25,
      isApplicable: true,
      description: "Standard corporate tax rate"
    }),
    TaxRule.make({
      name: "Value Added Tax (TVA)",
      rate: 0.20,
      isApplicable: true,
      description: "Standard VAT rate"
    })
  ),
  defaultFiscalYearEndMonth: 12,
  hasVat: true,
  hasWithholdingTax: true
})

/**
 * France jurisdiction
 */
export const FR_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: FR,
  name: "France",
  defaultCurrency: EUR,
  taxSettings: FR_TAX_SETTINGS
})

/**
 * Tax settings for Japan
 */
export const JP_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Corporate Income Tax",
      rate: 0.232,
      isApplicable: true,
      description: "National corporate tax rate"
    }),
    TaxRule.make({
      name: "Consumption Tax",
      rate: 0.10,
      isApplicable: true,
      description: "Japanese consumption tax"
    })
  ),
  defaultFiscalYearEndMonth: 3,
  hasVat: true,
  hasWithholdingTax: true
})

/**
 * Japan jurisdiction
 */
export const JP_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: JP,
  name: "Japan",
  defaultCurrency: JPY,
  taxSettings: JP_TAX_SETTINGS
})

/**
 * Tax settings for Singapore
 */
export const SG_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Corporate Income Tax",
      rate: 0.17,
      isApplicable: true,
      description: "Singapore corporate tax rate"
    }),
    TaxRule.make({
      name: "Goods and Services Tax (GST)",
      rate: 0.09,
      isApplicable: true,
      description: "Singapore GST rate"
    })
  ),
  defaultFiscalYearEndMonth: 12,
  hasVat: true,
  hasWithholdingTax: true
})

/**
 * Singapore jurisdiction
 */
export const SG_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: SG,
  name: "Singapore",
  defaultCurrency: SGD,
  taxSettings: SG_TAX_SETTINGS
})

/**
 * Tax settings for Hong Kong
 */
export const HK_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Profits Tax",
      rate: 0.165,
      isApplicable: true,
      description: "Hong Kong profits tax rate for corporations"
    })
  ),
  defaultFiscalYearEndMonth: 3,
  hasVat: false,
  hasWithholdingTax: false
})

/**
 * Hong Kong jurisdiction
 */
export const HK_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: HK,
  name: "Hong Kong",
  defaultCurrency: HKD,
  taxSettings: HK_TAX_SETTINGS
})

/**
 * Tax settings for Switzerland
 */
export const CH_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Federal Corporate Income Tax",
      rate: 0.085,
      isApplicable: true,
      description: "Federal corporate tax rate"
    }),
    TaxRule.make({
      name: "Value Added Tax (Mehrwertsteuer)",
      rate: 0.077,
      isApplicable: true,
      description: "Standard VAT rate"
    })
  ),
  defaultFiscalYearEndMonth: 12,
  hasVat: true,
  hasWithholdingTax: true
})

/**
 * Switzerland jurisdiction
 */
export const CH_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: CH,
  name: "Switzerland",
  defaultCurrency: CHF,
  taxSettings: CH_TAX_SETTINGS
})

/**
 * Tax settings for Netherlands
 */
export const NL_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Corporate Income Tax (Vennootschapsbelasting)",
      rate: 0.257,
      isApplicable: true,
      description: "Dutch corporate tax rate for profits over €200,000"
    }),
    TaxRule.make({
      name: "Value Added Tax (BTW)",
      rate: 0.21,
      isApplicable: true,
      description: "Standard VAT rate"
    })
  ),
  defaultFiscalYearEndMonth: 12,
  hasVat: true,
  hasWithholdingTax: true
})

/**
 * Netherlands jurisdiction
 */
export const NL_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: NL,
  name: "Netherlands",
  defaultCurrency: EUR,
  taxSettings: NL_TAX_SETTINGS
})

/**
 * Tax settings for Ireland
 */
export const IE_TAX_SETTINGS: TaxSettings = TaxSettings.make({
  taxRules: Chunk.make(
    TaxRule.make({
      name: "Corporation Tax",
      rate: 0.125,
      isApplicable: true,
      description: "Standard corporation tax rate"
    }),
    TaxRule.make({
      name: "Value Added Tax (VAT)",
      rate: 0.23,
      isApplicable: true,
      description: "Standard VAT rate"
    })
  ),
  defaultFiscalYearEndMonth: 12,
  hasVat: true,
  hasWithholdingTax: true
})

/**
 * Ireland jurisdiction
 */
export const IE_JURISDICTION: Jurisdiction = Jurisdiction.make({
  code: IE,
  name: "Ireland",
  defaultCurrency: EUR,
  taxSettings: IE_TAX_SETTINGS
})

/**
 * Collection of predefined jurisdictions
 */
export const PREDEFINED_JURISDICTIONS: ReadonlyArray<Jurisdiction> = [
  US_JURISDICTION,
  GB_JURISDICTION,
  CA_JURISDICTION,
  AU_JURISDICTION,
  DE_JURISDICTION,
  FR_JURISDICTION,
  JP_JURISDICTION,
  SG_JURISDICTION,
  HK_JURISDICTION,
  CH_JURISDICTION,
  NL_JURISDICTION,
  IE_JURISDICTION
]

/**
 * Map of jurisdiction code to Jurisdiction entity for quick lookup
 */
export const JURISDICTIONS_BY_CODE: ReadonlyMap<JurisdictionCode, Jurisdiction> = new Map(
  PREDEFINED_JURISDICTIONS.map((jurisdiction) => [jurisdiction.code, jurisdiction])
)

/**
 * Get a jurisdiction by its code from the predefined jurisdictions
 */
export const getJurisdictionByCode = (code: JurisdictionCode): Jurisdiction | undefined => {
  return JURISDICTIONS_BY_CODE.get(code)
}
