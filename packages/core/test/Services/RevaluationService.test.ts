import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, Exit, Layer, Option } from "effect"
import {
  CurrencyService,
  CurrencyServiceWithRevaluationLive,
  ExchangeRateRepository,
  AccountBalanceRepository,
  NoForeignCurrencyBalancesError,
  UnrealizedGainLossAccountNotFoundError,
  isNoForeignCurrencyBalancesError,
  isUnrealizedGainLossAccountNotFoundError,
  isRevaluationResult,
  isRevaluationAccountDetail,
  isRevaluationMethod,
  isAccountBalance,
  AccountBalance,
  RevaluationAccountDetail,
  RevaluationResult,
  DEFAULT_MONETARY_ACCOUNT_CRITERIA,
  type ExchangeRateRepositoryService,
  type AccountBalanceRepositoryService,
  type RevalueInput
} from "../../src/currency/CurrencyService.ts"
import { ExchangeRate, ExchangeRateId, Rate, type RateType } from "../../src/currency/ExchangeRate.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"
import { JournalEntryId, UserId } from "../../src/journal/JournalEntry.ts"
import { JournalEntryLineId } from "../../src/journal/JournalEntryLine.ts"
import { FiscalPeriodRef } from "../../src/fiscal/FiscalPeriodRef.ts"
import { AccountId } from "../../src/accounting/Account.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { OrganizationId } from "../../src/organization/Organization.ts"

describe("CurrencyService - Period-End Revaluation", () => {
  // Test data constants
  const rateUUID1 = "550e8400-e29b-41d4-a716-446655440000"
  const rateUUID2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  const companyUUID = CompanyId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
  const entryUUID = JournalEntryId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
  const userUUID = UserId.make("cccccccc-cccc-cccc-cccc-cccccccccccc")

  const cashAccountId = AccountId.make("11111111-1111-1111-1111-111111111111")
  const receivablesAccountId = AccountId.make("22222222-2222-2222-2222-222222222222")
  const payablesAccountId = AccountId.make("33333333-3333-3333-3333-333333333333")
  const gainAccountId = AccountId.make("44444444-4444-4444-4444-444444444444")
  const lossAccountId = AccountId.make("55555555-5555-5555-5555-555555555555")

  const usd = CurrencyCode.make("USD")
  const eur = CurrencyCode.make("EUR")
  const gbp = CurrencyCode.make("GBP")

  // Test organization ID for all exchange rate tests
  const testOrganizationId = OrganizationId.make("a1b2c3d4-e5f6-7890-abcd-ef1234567890")

  const closingDate = LocalDate.make({ year: 2025, month: 1, day: 31 })
  const fiscalPeriod = FiscalPeriodRef.make({ year: 2025, period: 1 })

  // Generate line IDs
  const generateLineIds = (count: number): ReadonlyArray<JournalEntryLineId> =>
    Array.from({ length: count }, (_, i) =>
      JournalEntryLineId.make(`${i}0000000-0000-0000-0000-00000000000${i}`)
    )

  // Helper to create test exchange rates
  const createExchangeRate = (
    id: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    rate: string,
    effectiveDate: LocalDate,
    rateType: RateType = "Closing"
  ): ExchangeRate => {
    return ExchangeRate.make({
      id: ExchangeRateId.make(id),
      organizationId: testOrganizationId,
      fromCurrency,
      toCurrency,
      rate: Rate.make(BigDecimal.unsafeFromString(rate)),
      effectiveDate,
      rateType,
      source: "Manual",
      createdAt: Timestamp.make({ epochMillis: Date.now() })
    })
  }

  // Mock exchange rate repository
  const createMockExchangeRateRepository = (
    initialRates: ReadonlyArray<ExchangeRate> = []
  ): ExchangeRateRepositoryService => {
    const rates = new Map<string, ExchangeRate>(
      initialRates.map((r) => [r.id, r])
    )

    const makePairKey = (
      from: CurrencyCode,
      to: CurrencyCode,
      date: LocalDate,
      type: RateType
    ): string => `${from}/${to}/${date.toISOString()}/${type}`

    return {
      findById: (id) =>
        Effect.succeed(Option.fromNullable(rates.get(id))),

      findByPairDateAndType: (fromCurrency, toCurrency, effectiveDate, rateType) => {
        const key = makePairKey(fromCurrency, toCurrency, effectiveDate, rateType)
        for (const rate of rates.values()) {
          const rateKey = makePairKey(
            rate.fromCurrency,
            rate.toCurrency,
            rate.effectiveDate,
            rate.rateType
          )
          if (rateKey === key) {
            return Effect.succeed(Option.some(rate))
          }
        }
        return Effect.succeed(Option.none())
      },

      findLatestByPair: (fromCurrency, toCurrency) => {
        let latestRate: ExchangeRate | undefined
        let latestDate: LocalDate | undefined

        for (const rate of rates.values()) {
          if (rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency) {
            if (!latestDate || isDateAfter(rate.effectiveDate, latestDate)) {
              latestRate = rate
              latestDate = rate.effectiveDate
            }
          }
        }

        return Effect.succeed(Option.fromNullable(latestRate))
      },

      save: (exchangeRate) => {
        rates.set(exchangeRate.id, exchangeRate)
        return Effect.succeed(exchangeRate)
      },

      update: (exchangeRate) => {
        rates.set(exchangeRate.id, exchangeRate)
        return Effect.succeed(exchangeRate)
      },

      exists: (fromCurrency, toCurrency, effectiveDate, rateType) => {
        const key = makePairKey(fromCurrency, toCurrency, effectiveDate, rateType)
        for (const rate of rates.values()) {
          const rateKey = makePairKey(
            rate.fromCurrency,
            rate.toCurrency,
            rate.effectiveDate,
            rate.rateType
          )
          if (rateKey === key) {
            return Effect.succeed(true)
          }
        }
        return Effect.succeed(false)
      }
    }
  }

  // Helper to compare dates
  const isDateAfter = (a: LocalDate, b: LocalDate): boolean => {
    if (a.year !== b.year) return a.year > b.year
    if (a.month !== b.month) return a.month > b.month
    return a.day > b.day
  }

  // Mock account balance repository
  const createMockAccountBalanceRepository = (
    balances: ReadonlyArray<AccountBalance>,
    gainAccount: AccountId | null = gainAccountId,
    lossAccount: AccountId | null = lossAccountId
  ): AccountBalanceRepositoryService => {
    return {
      getForeignCurrencyBalances: (_companyId, _functionalCurrency, _asOfDate, _criteria) =>
        Effect.succeed(balances),

      getUnrealizedGainLossAccount: (_companyId, type) =>
        Effect.succeed(
          type === "UnrealizedGain"
            ? Option.fromNullable(gainAccount)
            : Option.fromNullable(lossAccount)
        )
    }
  }

  // Create test layer
  const createTestLayer = (
    rates: ReadonlyArray<ExchangeRate>,
    balances: ReadonlyArray<AccountBalance>,
    gainAccount: AccountId | null = gainAccountId,
    lossAccount: AccountId | null = lossAccountId
  ) => {
    const rateRepoLayer = Layer.succeed(
      ExchangeRateRepository,
      createMockExchangeRateRepository(rates)
    )
    const balanceRepoLayer = Layer.succeed(
      AccountBalanceRepository,
      createMockAccountBalanceRepository(balances, gainAccount, lossAccount)
    )

    return CurrencyServiceWithRevaluationLive.pipe(
      Layer.provide(rateRepoLayer),
      Layer.provide(balanceRepoLayer)
    )
  }

  // Create default revalue input
  const createRevalueInput = (lineCount: number = 10): RevalueInput => ({
    companyId: companyUUID,
    fiscalPeriod,
    closingDate,
    functionalCurrency: usd,
    method: "BalanceSheet",
    journalEntryId: entryUUID,
    journalEntryLineIds: generateLineIds(lineCount),
    performedBy: userUUID
  })

  // Create account balance helper
  const createAccountBalance = (
    accountId: AccountId,
    name: string,
    type: "Asset" | "Liability",
    category: string,
    foreignAmount: string,
    foreignCurrency: CurrencyCode,
    functionalAmount: string,
    functionalCurrency: CurrencyCode,
    bookRate: string
  ): AccountBalance => {
    return AccountBalance.make({
      accountId,
      accountName: name,
      accountType: type,
      accountCategory: category,
      foreignCurrencyBalance: MonetaryAmount.unsafeFromString(foreignAmount, foreignCurrency),
      functionalCurrencyBalance: MonetaryAmount.unsafeFromString(functionalAmount, functionalCurrency),
      bookRate: BigDecimal.unsafeFromString(bookRate)
    })
  }

  describe("revalue - successful revaluation", () => {
    it.effect("revalues a single foreign currency asset with gain", () =>
      Effect.gen(function* () {
        // EUR cash account: 1000 EUR at book rate 1.10 = 1100 USD
        // Closing rate: 1.15 (EUR appreciated)
        // New value: 1000 * 1.15 = 1150 USD
        // Gain: 1150 - 1100 = 50 USD

        const service = yield* CurrencyService
        const result = yield* service.revalue(createRevalueInput())

        expect(isRevaluationResult(result)).toBe(true)
        expect(result.companyId).toBe(companyUUID)
        expect(result.method).toBe("BalanceSheet")
        expect(result.accountCount).toBe(1)
        expect(result.hasNetGain).toBe(true)
        expect(result.hasNetLoss).toBe(false)

        // Check account detail
        const detail = result.accountDetails[0]
        expect(detail.accountId).toBe(cashAccountId)
        expect(detail.accountType).toBe("Asset")
        expect(detail.isGain).toBe(true)
        expect(BigDecimal.equals(detail.closingRate, BigDecimal.unsafeFromString("1.15"))).toBe(true)
        expect(BigDecimal.equals(
          detail.gainOrLoss.amount,
          BigDecimal.unsafeFromString("50")
        )).toBe(true)

        // Check totals
        expect(BigDecimal.equals(
          result.totalUnrealizedGain.amount,
          BigDecimal.unsafeFromString("50")
        )).toBe(true)
        expect(result.totalUnrealizedLoss.isZero).toBe(true)
        expect(BigDecimal.equals(
          result.netGainOrLoss.amount,
          BigDecimal.unsafeFromString("50")
        )).toBe(true)

        // Check journal entry was created
        expect(Option.isSome(result.journalEntry)).toBe(true)
        const entry = Option.getOrThrow(result.journalEntry)
        expect(entry.entryType).toBe("Revaluation")
        expect(entry.sourceModule).toBe("GeneralLedger")

        // Check journal entry lines
        expect(result.journalEntryLines.length).toBe(2) // Asset debit + Gain credit
      }).pipe(Effect.provide(createTestLayer(
        [createExchangeRate(rateUUID1, eur, usd, "1.15", closingDate, "Closing")],
        [createAccountBalance(
          cashAccountId,
          "Cash - EUR",
          "Asset",
          "CurrentAsset",
          "1000.00",
          eur,
          "1100.00",
          usd,
          "1.10"
        )]
      )))
    )

    it.effect("revalues a single foreign currency asset with loss", () =>
      Effect.gen(function* () {
        // EUR cash account: 1000 EUR at book rate 1.10 = 1100 USD
        // Closing rate: 1.05 (EUR depreciated)
        // New value: 1000 * 1.05 = 1050 USD
        // Loss: 1050 - 1100 = -50 USD
        const service = yield* CurrencyService
        const result = yield* service.revalue(createRevalueInput())

        expect(result.hasNetLoss).toBe(true)
        expect(result.hasNetGain).toBe(false)

        const detail = result.accountDetails[0]
        expect(detail.isLoss).toBe(true)
        expect(BigDecimal.equals(
          detail.gainOrLoss.amount,
          BigDecimal.unsafeFromString("-50")
        )).toBe(true)

        expect(BigDecimal.equals(
          result.totalUnrealizedLoss.amount,
          BigDecimal.unsafeFromString("50")
        )).toBe(true)

        // Journal entry lines: Asset credit + Loss debit
        expect(result.journalEntryLines.length).toBe(2)
      }).pipe(Effect.provide(createTestLayer(
        [createExchangeRate(rateUUID1, eur, usd, "1.05", closingDate, "Closing")],
        [createAccountBalance(
          cashAccountId,
          "Cash - EUR",
          "Asset",
          "CurrentAsset",
          "1000.00",
          eur,
          "1100.00",
          usd,
          "1.10"
        )]
      )))
    )

    it.effect("revalues a foreign currency liability with gain (liability decreased)", () =>
      Effect.gen(function* () {
        // EUR payables: 1000 EUR at book rate 1.10 = 1100 USD owed
        // Closing rate: 1.05 (EUR depreciated)
        // New value: 1000 * 1.05 = 1050 USD owed
        // For liabilities: decrease in value = gain
        // Gain: 1100 - 1050 = 50 USD
        const service = yield* CurrencyService
        const result = yield* service.revalue(createRevalueInput())

        expect(result.hasNetGain).toBe(true)

        const detail = result.accountDetails[0]
        expect(detail.accountType).toBe("Liability")
        expect(detail.isGain).toBe(true)

        // Liability decreased (good for us), so it's a gain
        expect(BigDecimal.equals(
          detail.gainOrLoss.amount,
          BigDecimal.unsafeFromString("50")
        )).toBe(true)
      }).pipe(Effect.provide(createTestLayer(
        [createExchangeRate(rateUUID1, eur, usd, "1.05", closingDate, "Closing")],
        [createAccountBalance(
          payablesAccountId,
          "Accounts Payable - EUR",
          "Liability",
          "CurrentLiability",
          "1000.00",
          eur,
          "1100.00",
          usd,
          "1.10"
        )]
      )))
    )

    it.effect("revalues a foreign currency liability with loss (liability increased)", () =>
      Effect.gen(function* () {
        // EUR payables: 1000 EUR at book rate 1.10 = 1100 USD owed
        // Closing rate: 1.15 (EUR appreciated)
        // New value: 1000 * 1.15 = 1150 USD owed
        // For liabilities: increase in value = loss
        // Loss: 1150 - 1100 = 50 USD
        const service = yield* CurrencyService
        const result = yield* service.revalue(createRevalueInput())

        expect(result.hasNetLoss).toBe(true)

        const detail = result.accountDetails[0]
        expect(detail.accountType).toBe("Liability")
        expect(detail.isLoss).toBe(true)

        // Liability increased (bad for us), so it's a loss
        expect(BigDecimal.equals(
          detail.gainOrLoss.amount,
          BigDecimal.unsafeFromString("-50")
        )).toBe(true)
      }).pipe(Effect.provide(createTestLayer(
        [createExchangeRate(rateUUID1, eur, usd, "1.15", closingDate, "Closing")],
        [createAccountBalance(
          payablesAccountId,
          "Accounts Payable - EUR",
          "Liability",
          "CurrentLiability",
          "1000.00",
          eur,
          "1100.00",
          usd,
          "1.10"
        )]
      )))
    )

    it.effect("revalues multiple accounts with mixed gains and losses", () =>
      Effect.gen(function* () {
        // EUR cash: 1000 EUR at 1.10 = 1100 USD, new rate 1.15 = 1150 USD -> +50 gain
        // GBP receivables: 500 GBP at 1.30 = 650 USD, new rate 1.25 = 625 USD -> -25 loss
        // EUR payables: 500 EUR at 1.10 = 550 USD, new rate 1.15 = 575 USD -> -25 loss (liability increased)
        const service = yield* CurrencyService
        const result = yield* service.revalue(createRevalueInput())

        expect(result.accountCount).toBe(3)
        expect(result.hasNetGain).toBe(false)
        expect(result.hasNetLoss).toBe(false)
        expect(result.hasNoAdjustment).toBe(true) // Net is zero

        // Total gain = 50 (from EUR cash)
        expect(BigDecimal.equals(
          result.totalUnrealizedGain.amount,
          BigDecimal.unsafeFromString("50")
        )).toBe(true)

        // Total loss = 25 (GBP receivables) + 25 (EUR payables) = 50
        expect(BigDecimal.equals(
          result.totalUnrealizedLoss.amount,
          BigDecimal.unsafeFromString("50")
        )).toBe(true)

        // Net = 50 - 50 = 0
        expect(result.netGainOrLoss.isZero).toBe(true)
      }).pipe(Effect.provide(createTestLayer(
        [
          createExchangeRate(rateUUID1, eur, usd, "1.15", closingDate, "Closing"),
          createExchangeRate(rateUUID2, gbp, usd, "1.25", closingDate, "Closing")
        ],
        [
          createAccountBalance(
            cashAccountId,
            "Cash - EUR",
            "Asset",
            "CurrentAsset",
            "1000.00",
            eur,
            "1100.00",
            usd,
            "1.10"
          ),
          createAccountBalance(
            receivablesAccountId,
            "AR - GBP",
            "Asset",
            "CurrentAsset",
            "500.00",
            gbp,
            "650.00",
            usd,
            "1.30"
          ),
          createAccountBalance(
            payablesAccountId,
            "AP - EUR",
            "Liability",
            "CurrentLiability",
            "500.00",
            eur,
            "550.00",
            usd,
            "1.10"
          )
        ]
      )))
    )

    it.effect("uses inverse rate when direct rate is not available", () =>
      Effect.gen(function* () {
        // Only USD/EUR rate available, need EUR/USD for translation
        // USD/EUR = 0.87 means 1 USD = 0.87 EUR
        // EUR/USD (inverse) = 1/0.87 ≈ 1.1494
        const service = yield* CurrencyService
        const result = yield* service.revalue(createRevalueInput())

        expect(result.accountCount).toBe(1)
        const detail = result.accountDetails[0]

        // The closing rate should be the inverse of 0.87
        const inverseRate = BigDecimal.divide(
          BigDecimal.fromNumber(1),
          BigDecimal.unsafeFromString("0.87")
        )
        expect(Option.isSome(inverseRate)).toBe(true)

        // The rate should be approximately 1.149425...
        expect(BigDecimal.greaterThan(detail.closingRate, BigDecimal.unsafeFromString("1.14"))).toBe(true)
        expect(BigDecimal.lessThan(detail.closingRate, BigDecimal.unsafeFromString("1.16"))).toBe(true)
      }).pipe(Effect.provide(createTestLayer(
        // Only USD/EUR rate available (inverse direction)
        [createExchangeRate(rateUUID1, usd, eur, "0.87", closingDate, "Closing")],
        [createAccountBalance(
          cashAccountId,
          "Cash - EUR",
          "Asset",
          "CurrentAsset",
          "1000.00",
          eur,
          "1100.00",
          usd,
          "1.10"
        )]
      )))
    )

    it.effect("returns no journal entry when there is no adjustment needed", () =>
      Effect.gen(function* () {
        // Rate unchanged, so no adjustment needed
        const service = yield* CurrencyService
        const result = yield* service.revalue(createRevalueInput())

        expect(result.accountCount).toBe(1)
        expect(result.hasNoAdjustment).toBe(true)
        expect(Option.isNone(result.journalEntry)).toBe(true)
        expect(result.journalEntryLines.length).toBe(0)
      }).pipe(Effect.provide(createTestLayer(
        [createExchangeRate(rateUUID1, eur, usd, "1.10", closingDate, "Closing")],
        [createAccountBalance(
          cashAccountId,
          "Cash - EUR",
          "Asset",
          "CurrentAsset",
          "1000.00",
          eur,
          "1100.00",
          usd,
          "1.10"
        )]
      )))
    )

    it.effect("creates proper journal entry structure", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyService
        const result = yield* service.revalue(createRevalueInput())

        expect(Option.isSome(result.journalEntry)).toBe(true)
        const entry = Option.getOrThrow(result.journalEntry)

        // Check entry properties
        expect(entry.id).toBe(entryUUID)
        expect(entry.companyId).toBe(companyUUID)
        expect(entry.transactionDate.year).toBe(2025)
        expect(entry.transactionDate.month).toBe(1)
        expect(entry.transactionDate.day).toBe(31)
        expect(entry.fiscalPeriod.year).toBe(2025)
        expect(entry.fiscalPeriod.period).toBe(1)
        expect(entry.entryType).toBe("Revaluation")
        expect(entry.sourceModule).toBe("GeneralLedger")
        expect(entry.status).toBe("Draft")
        expect(entry.createdBy).toBe(userUUID)
        expect(Option.isSome(entry.referenceNumber)).toBe(true)
        expect(Option.getOrThrow(entry.referenceNumber)).toContain("REVAL")
      }).pipe(Effect.provide(createTestLayer(
        [createExchangeRate(rateUUID1, eur, usd, "1.15", closingDate, "Closing")],
        [createAccountBalance(
          cashAccountId,
          "Cash - EUR",
          "Asset",
          "CurrentAsset",
          "1000.00",
          eur,
          "1100.00",
          usd,
          "1.10"
        )]
      )))
    )
  })

  describe("revalue - error scenarios", () => {
    it.effect("fails with NoForeignCurrencyBalancesError when no balances", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyService
        const result = yield* Effect.exit(service.revalue(createRevalueInput()))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          const error = result.cause.error
          expect(isNoForeignCurrencyBalancesError(error)).toBe(true)
          if (isNoForeignCurrencyBalancesError(error)) {
            expect(error.companyId).toBe(companyUUID)
            expect(error.closingDate.year).toBe(2025)
            expect(error.closingDate.month).toBe(1)
            expect(error.closingDate.day).toBe(31)
          }
        }
      }).pipe(Effect.provide(createTestLayer(
        [createExchangeRate(rateUUID1, eur, usd, "1.15", closingDate, "Closing")],
        [] // No balances
      )))
    )

    it.effect("fails with RateNotFoundError when closing rate is missing", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyService
        const result = yield* Effect.exit(service.revalue(createRevalueInput()))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          const error = result.cause.error
          expect(error._tag).toBe("RateNotFoundError")
          if (error._tag === "RateNotFoundError") {
            expect(error.rateType).toBe("Closing")
          }
        }
      }).pipe(Effect.provide(createTestLayer(
        [], // No rates
        [createAccountBalance(
          cashAccountId,
          "Cash - EUR",
          "Asset",
          "CurrentAsset",
          "1000.00",
          eur,
          "1100.00",
          usd,
          "1.10"
        )]
      )))
    )

    it.effect("fails with UnrealizedGainLossAccountNotFoundError when gain account missing", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyService
        const result = yield* Effect.exit(service.revalue(createRevalueInput()))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          const error = result.cause.error
          expect(isUnrealizedGainLossAccountNotFoundError(error)).toBe(true)
          if (isUnrealizedGainLossAccountNotFoundError(error)) {
            expect(error.accountType).toBe("UnrealizedGain")
          }
        }
      }).pipe(Effect.provide(createTestLayer(
        [createExchangeRate(rateUUID1, eur, usd, "1.15", closingDate, "Closing")],
        [createAccountBalance(
          cashAccountId,
          "Cash - EUR",
          "Asset",
          "CurrentAsset",
          "1000.00",
          eur,
          "1100.00",
          usd,
          "1.10"
        )],
        null, // No gain account
        lossAccountId
      )))
    )

    it.effect("fails with UnrealizedGainLossAccountNotFoundError when loss account missing", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyService
        const result = yield* Effect.exit(service.revalue(createRevalueInput()))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          const error = result.cause.error
          expect(isUnrealizedGainLossAccountNotFoundError(error)).toBe(true)
          if (isUnrealizedGainLossAccountNotFoundError(error)) {
            expect(error.accountType).toBe("UnrealizedLoss")
          }
        }
      }).pipe(Effect.provide(createTestLayer(
        [createExchangeRate(rateUUID1, eur, usd, "1.05", closingDate, "Closing")], // Rate causes loss
        [createAccountBalance(
          cashAccountId,
          "Cash - EUR",
          "Asset",
          "CurrentAsset",
          "1000.00",
          eur,
          "1100.00",
          usd,
          "1.10"
        )],
        gainAccountId,
        null // No loss account
      )))
    )
  })

  describe("error type guards and messages", () => {
    it("isNoForeignCurrencyBalancesError returns true for NoForeignCurrencyBalancesError", () => {
      const error = new NoForeignCurrencyBalancesError({
        companyId: companyUUID,
        closingDate: { year: 2025, month: 1, day: 31 }
      })
      expect(isNoForeignCurrencyBalancesError(error)).toBe(true)
      expect(error._tag).toBe("NoForeignCurrencyBalancesError")
      expect(error.message).toContain("No monetary accounts")
      expect(error.message).toContain(companyUUID)
      expect(error.message).toContain("2025-01-31")
    })

    it("isUnrealizedGainLossAccountNotFoundError returns true for UnrealizedGainLossAccountNotFoundError", () => {
      const error = new UnrealizedGainLossAccountNotFoundError({
        companyId: companyUUID,
        accountType: "UnrealizedGain"
      })
      expect(isUnrealizedGainLossAccountNotFoundError(error)).toBe(true)
      expect(error._tag).toBe("UnrealizedGainLossAccountNotFoundError")
      expect(error.message).toContain("Unrealized gain")
      expect(error.message).toContain("not configured")
    })

    it("type guards return false for other values", () => {
      expect(isNoForeignCurrencyBalancesError(null)).toBe(false)
      expect(isNoForeignCurrencyBalancesError(undefined)).toBe(false)
      expect(isNoForeignCurrencyBalancesError(new Error("test"))).toBe(false)

      expect(isUnrealizedGainLossAccountNotFoundError(null)).toBe(false)
      expect(isUnrealizedGainLossAccountNotFoundError(undefined)).toBe(false)
    })
  })

  describe("RevaluationResult type", () => {
    it("isRevaluationResult returns true for RevaluationResult", () => {
      const result = RevaluationResult.make({
        companyId: companyUUID,
        fiscalPeriod: { year: 2025, period: 1 },
        closingDate,
        method: "BalanceSheet",
        accountDetails: [],
        totalUnrealizedGain: MonetaryAmount.zero(usd),
        totalUnrealizedLoss: MonetaryAmount.zero(usd),
        netGainOrLoss: MonetaryAmount.zero(usd),
        journalEntry: Option.none(),
        journalEntryLines: [],
        createdAt: Timestamp.make({ epochMillis: Date.now() })
      })
      expect(isRevaluationResult(result)).toBe(true)
    })

    it("isRevaluationResult returns false for other values", () => {
      expect(isRevaluationResult(null)).toBe(false)
      expect(isRevaluationResult(undefined)).toBe(false)
      expect(isRevaluationResult({ _tag: "RevaluationResult" })).toBe(false)
    })

    it("RevaluationResult getters work correctly", () => {
      const result = RevaluationResult.make({
        companyId: companyUUID,
        fiscalPeriod: { year: 2025, period: 1 },
        closingDate,
        method: "BalanceSheet",
        accountDetails: [
          RevaluationAccountDetail.make({
            accountId: cashAccountId,
            accountName: "Cash - EUR",
            accountType: "Asset",
            currency: eur,
            foreignCurrencyBalance: MonetaryAmount.unsafeFromString("1000", "EUR"),
            previousFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("1100", "USD"),
            newFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("1150", "USD"),
            bookRate: BigDecimal.unsafeFromString("1.10"),
            closingRate: BigDecimal.unsafeFromString("1.15"),
            gainOrLoss: MonetaryAmount.unsafeFromString("50", "USD")
          }),
          RevaluationAccountDetail.make({
            accountId: receivablesAccountId,
            accountName: "AR - GBP",
            accountType: "Asset",
            currency: gbp,
            foreignCurrencyBalance: MonetaryAmount.unsafeFromString("500", "GBP"),
            previousFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("650", "USD"),
            newFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("625", "USD"),
            bookRate: BigDecimal.unsafeFromString("1.30"),
            closingRate: BigDecimal.unsafeFromString("1.25"),
            gainOrLoss: MonetaryAmount.unsafeFromString("-25", "USD")
          })
        ],
        totalUnrealizedGain: MonetaryAmount.unsafeFromString("50", "USD"),
        totalUnrealizedLoss: MonetaryAmount.unsafeFromString("25", "USD"),
        netGainOrLoss: MonetaryAmount.unsafeFromString("25", "USD"),
        journalEntry: Option.none(),
        journalEntryLines: [],
        createdAt: Timestamp.make({ epochMillis: Date.now() })
      })

      expect(result.accountCount).toBe(2)
      expect(result.accountsWithGains.length).toBe(1)
      expect(result.accountsWithLosses.length).toBe(1)
      expect(result.hasNetGain).toBe(true)
      expect(result.hasNetLoss).toBe(false)
    })
  })

  describe("RevaluationAccountDetail type", () => {
    it("isRevaluationAccountDetail returns true for RevaluationAccountDetail", () => {
      const detail = RevaluationAccountDetail.make({
        accountId: cashAccountId,
        accountName: "Cash - EUR",
        accountType: "Asset",
        currency: eur,
        foreignCurrencyBalance: MonetaryAmount.unsafeFromString("1000", "EUR"),
        previousFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("1100", "USD"),
        newFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("1150", "USD"),
        bookRate: BigDecimal.unsafeFromString("1.10"),
        closingRate: BigDecimal.unsafeFromString("1.15"),
        gainOrLoss: MonetaryAmount.unsafeFromString("50", "USD")
      })
      expect(isRevaluationAccountDetail(detail)).toBe(true)
    })

    it("RevaluationAccountDetail getters work correctly", () => {
      const gainDetail = RevaluationAccountDetail.make({
        accountId: cashAccountId,
        accountName: "Cash - EUR",
        accountType: "Asset",
        currency: eur,
        foreignCurrencyBalance: MonetaryAmount.unsafeFromString("1000", "EUR"),
        previousFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("1100", "USD"),
        newFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("1150", "USD"),
        bookRate: BigDecimal.unsafeFromString("1.10"),
        closingRate: BigDecimal.unsafeFromString("1.15"),
        gainOrLoss: MonetaryAmount.unsafeFromString("50", "USD")
      })
      expect(gainDetail.isGain).toBe(true)
      expect(gainDetail.isLoss).toBe(false)
      expect(gainDetail.isUnchanged).toBe(false)

      const lossDetail = RevaluationAccountDetail.make({
        accountId: cashAccountId,
        accountName: "Cash - EUR",
        accountType: "Asset",
        currency: eur,
        foreignCurrencyBalance: MonetaryAmount.unsafeFromString("1000", "EUR"),
        previousFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("1100", "USD"),
        newFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("1050", "USD"),
        bookRate: BigDecimal.unsafeFromString("1.10"),
        closingRate: BigDecimal.unsafeFromString("1.05"),
        gainOrLoss: MonetaryAmount.unsafeFromString("-50", "USD")
      })
      expect(lossDetail.isGain).toBe(false)
      expect(lossDetail.isLoss).toBe(true)
      expect(lossDetail.isUnchanged).toBe(false)

      const unchangedDetail = RevaluationAccountDetail.make({
        accountId: cashAccountId,
        accountName: "Cash - EUR",
        accountType: "Asset",
        currency: eur,
        foreignCurrencyBalance: MonetaryAmount.unsafeFromString("1000", "EUR"),
        previousFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("1100", "USD"),
        newFunctionalCurrencyBalance: MonetaryAmount.unsafeFromString("1100", "USD"),
        bookRate: BigDecimal.unsafeFromString("1.10"),
        closingRate: BigDecimal.unsafeFromString("1.10"),
        gainOrLoss: MonetaryAmount.zero(usd)
      })
      expect(unchangedDetail.isGain).toBe(false)
      expect(unchangedDetail.isLoss).toBe(false)
      expect(unchangedDetail.isUnchanged).toBe(true)
    })
  })

  describe("AccountBalance type", () => {
    it("isAccountBalance returns true for AccountBalance", () => {
      const balance = AccountBalance.make({
        accountId: cashAccountId,
        accountName: "Cash - EUR",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        foreignCurrencyBalance: MonetaryAmount.unsafeFromString("1000", "EUR"),
        functionalCurrencyBalance: MonetaryAmount.unsafeFromString("1100", "USD"),
        bookRate: BigDecimal.unsafeFromString("1.10")
      })
      expect(isAccountBalance(balance)).toBe(true)
    })

    it("isAccountBalance returns false for other values", () => {
      expect(isAccountBalance(null)).toBe(false)
      expect(isAccountBalance(undefined)).toBe(false)
    })
  })

  describe("RevaluationMethod type", () => {
    it("isRevaluationMethod returns true for valid methods", () => {
      expect(isRevaluationMethod("BalanceSheet")).toBe(true)
      expect(isRevaluationMethod("OpenItems")).toBe(true)
    })

    it("isRevaluationMethod returns false for invalid values", () => {
      expect(isRevaluationMethod("Invalid")).toBe(false)
      expect(isRevaluationMethod(null)).toBe(false)
      expect(isRevaluationMethod(undefined)).toBe(false)
    })
  })

  describe("DEFAULT_MONETARY_ACCOUNT_CRITERIA", () => {
    it("contains expected categories", () => {
      expect(DEFAULT_MONETARY_ACCOUNT_CRITERIA.categories).toContain("CurrentAsset")
      expect(DEFAULT_MONETARY_ACCOUNT_CRITERIA.categories).toContain("CurrentLiability")
      expect(DEFAULT_MONETARY_ACCOUNT_CRITERIA.categories).toContain("NonCurrentLiability")
    })

    it("contains expected types", () => {
      expect(DEFAULT_MONETARY_ACCOUNT_CRITERIA.types).toContain("Asset")
      expect(DEFAULT_MONETARY_ACCOUNT_CRITERIA.types).toContain("Liability")
    })
  })
})
