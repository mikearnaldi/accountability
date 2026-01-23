/**
 * CompanyRepositoryLive - PostgreSQL implementation of CompanyRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module CompanyRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AccountId } from "@accountability/core/accounting/Account"
import { Address } from "@accountability/core/shared/values/Address"
import { Company, CompanyId, FiscalYearEnd } from "@accountability/core/company/Company"
import type { CompanyType } from "@accountability/core/company/CompanyType"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { JurisdictionCode } from "@accountability/core/jurisdiction/JurisdictionCode"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { CompanyRepository, type CompanyRepositoryService } from "../Services/CompanyRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from companies table
 * Uses proper literal types for enum fields to avoid type assertions
 */
const CompanyRow = Schema.Struct({
  id: Schema.String,
  organization_id: Schema.String,
  name: Schema.String,
  legal_name: Schema.String,
  jurisdiction: Schema.String,
  tax_id: Schema.NullOr(Schema.String),
  incorporation_date: Schema.NullOr(Schema.DateFromSelf),
  registration_number: Schema.NullOr(Schema.String),
  registered_address_street1: Schema.NullOr(Schema.String),
  registered_address_street2: Schema.NullOr(Schema.String),
  registered_address_city: Schema.NullOr(Schema.String),
  registered_address_state: Schema.NullOr(Schema.String),
  registered_address_postal_code: Schema.NullOr(Schema.String),
  registered_address_country: Schema.NullOr(Schema.String),
  industry_code: Schema.NullOr(Schema.String),
  company_type: Schema.NullOr(Schema.String),
  incorporation_jurisdiction: Schema.NullOr(Schema.String),
  functional_currency: Schema.String,
  reporting_currency: Schema.String,
  fiscal_year_end_month: Schema.Number,
  fiscal_year_end_day: Schema.Number,
  retained_earnings_account_id: Schema.NullOr(Schema.String),
  is_active: Schema.Boolean,
  created_at: Schema.DateFromSelf
})
type CompanyRow = typeof CompanyRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Convert database row to Company domain entity
 * Pure function - no Effect wrapping needed
 */
/**
 * Check if any address field has a value
 */
const hasAddressData = (row: CompanyRow): boolean =>
  row.registered_address_street1 !== null ||
  row.registered_address_street2 !== null ||
  row.registered_address_city !== null ||
  row.registered_address_state !== null ||
  row.registered_address_postal_code !== null ||
  row.registered_address_country !== null

/**
 * Build address from row fields
 */
const buildAddress = (row: CompanyRow): Address =>
  Address.make({
    street1: Option.fromNullable(row.registered_address_street1),
    street2: Option.fromNullable(row.registered_address_street2),
    city: Option.fromNullable(row.registered_address_city),
    state: Option.fromNullable(row.registered_address_state),
    postalCode: Option.fromNullable(row.registered_address_postal_code),
    country: Option.fromNullable(row.registered_address_country)
  })

/**
 * Map company type string to CompanyType literal
 */
const COMPANY_TYPE_MAP: Record<string, CompanyType> = {
  "Corporation": "Corporation",
  "LLC": "LLC",
  "Partnership": "Partnership",
  "SoleProprietorship": "SoleProprietorship",
  "NonProfit": "NonProfit",
  "Cooperative": "Cooperative",
  "Branch": "Branch",
  "Other": "Other"
}

const rowToCompany = (row: CompanyRow): Company =>
  Company.make({
    id: CompanyId.make(row.id),
    organizationId: OrganizationId.make(row.organization_id),
    name: row.name,
    legalName: row.legal_name,
    jurisdiction: JurisdictionCode.make(row.jurisdiction),
    taxId: Option.fromNullable(row.tax_id),
    // Use local date methods because pg driver returns DATE columns as local midnight
    incorporationDate: Option.fromNullable(row.incorporation_date).pipe(
      Option.map((d) => LocalDate.make({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate()
      }))
    ),
    registrationNumber: Option.fromNullable(row.registration_number),
    registeredAddress: hasAddressData(row) ? Option.some(buildAddress(row)) : Option.none(),
    industryCode: Option.fromNullable(row.industry_code),
    companyType: Option.fromNullable(row.company_type).pipe(
      Option.flatMap((t) => Option.fromNullable(COMPANY_TYPE_MAP[t]))
    ),
    incorporationJurisdiction: Option.fromNullable(row.incorporation_jurisdiction).pipe(
      Option.map(JurisdictionCode.make)
    ),
    functionalCurrency: CurrencyCode.make(row.functional_currency),
    reportingCurrency: CurrencyCode.make(row.reporting_currency),
    fiscalYearEnd: FiscalYearEnd.make({
      month: row.fiscal_year_end_month,
      day: row.fiscal_year_end_day
    }),
    retainedEarningsAccountId: Option.fromNullable(row.retained_earnings_account_id).pipe(
      Option.map(AccountId.make)
    ),
    isActive: row.is_active,
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() })
  })

/**
 * Implementation of CompanyRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  // Schema for find by org and id request
  const FindByOrgAndIdRequest = Schema.Struct({
    organizationId: Schema.String,
    id: Schema.String
  })

  const findCompanyByOrgAndId = SqlSchema.findOne({
    Request: FindByOrgAndIdRequest,
    Result: CompanyRow,
    execute: ({ organizationId, id }) => sql`SELECT * FROM companies WHERE id = ${id} AND organization_id = ${organizationId}`
  })

  const findCompaniesByOrganization = SqlSchema.findAll({
    Request: Schema.String,
    Result: CompanyRow,
    execute: (organizationId) => sql`
      SELECT * FROM companies WHERE organization_id = ${organizationId} ORDER BY name
    `
  })

  const findActiveCompaniesByOrganization = SqlSchema.findAll({
    Request: Schema.String,
    Result: CompanyRow,
    execute: (organizationId) => sql`
      SELECT * FROM companies
      WHERE organization_id = ${organizationId} AND is_active = true
      ORDER BY name
    `
  })

  // Schema for count by org and id request
  const CountByOrgAndIdRequest = Schema.Struct({
    organizationId: Schema.String,
    id: Schema.String
  })

  const countByOrgAndId = SqlSchema.single({
    Request: CountByOrgAndIdRequest,
    Result: CountRow,
    execute: ({ organizationId, id }) => sql`SELECT COUNT(*) as count FROM companies WHERE id = ${id} AND organization_id = ${organizationId}`
  })

  const findById: CompanyRepositoryService["findById"] = (organizationId, id) =>
    findCompanyByOrgAndId({ organizationId, id }).pipe(
      Effect.map(Option.map(rowToCompany)),
      wrapSqlError("findById")
    )

  const findByOrganization: CompanyRepositoryService["findByOrganization"] = (organizationId) =>
    findCompaniesByOrganization(organizationId).pipe(
      Effect.map((rows) => rows.map(rowToCompany)),
      wrapSqlError("findByOrganization")
    )

  const create: CompanyRepositoryService["create"] = (company) =>
    Effect.gen(function* () {
      // Convert incorporationDate Option<LocalDate> to ISO string | null for SQL
      // Use ISO strings to avoid timezone conversion issues with DATE columns
      const incorporationDateValue = Option.getOrNull(
        Option.map(company.incorporationDate, (ld) => ld.toString())
      )

      // Extract address fields
      const address = Option.getOrNull(company.registeredAddress)

      yield* sql`
        INSERT INTO companies (
          id, organization_id, name, legal_name, jurisdiction, tax_id,
          incorporation_date, registration_number,
          registered_address_street1, registered_address_street2,
          registered_address_city, registered_address_state,
          registered_address_postal_code, registered_address_country,
          industry_code, company_type, incorporation_jurisdiction,
          functional_currency, reporting_currency,
          fiscal_year_end_month, fiscal_year_end_day,
          retained_earnings_account_id,
          is_active, created_at
        ) VALUES (
          ${company.id},
          ${company.organizationId},
          ${company.name},
          ${company.legalName},
          ${company.jurisdiction},
          ${Option.getOrNull(company.taxId)},
          ${incorporationDateValue}::date,
          ${Option.getOrNull(company.registrationNumber)},
          ${address ? Option.getOrNull(address.street1) : null},
          ${address ? Option.getOrNull(address.street2) : null},
          ${address ? Option.getOrNull(address.city) : null},
          ${address ? Option.getOrNull(address.state) : null},
          ${address ? Option.getOrNull(address.postalCode) : null},
          ${address ? Option.getOrNull(address.country) : null},
          ${Option.getOrNull(company.industryCode)},
          ${Option.getOrNull(company.companyType)},
          ${Option.getOrNull(company.incorporationJurisdiction)},
          ${company.functionalCurrency},
          ${company.reportingCurrency},
          ${company.fiscalYearEnd.month},
          ${company.fiscalYearEnd.day},
          ${Option.getOrNull(company.retainedEarningsAccountId)},
          ${company.isActive},
          ${company.createdAt.toDate()}
        )
      `.pipe(wrapSqlError("create"))

      return company
    })

  const update: CompanyRepositoryService["update"] = (organizationId, company) =>
    Effect.gen(function* () {
      // Check if company exists first (with org filter for security)
      const existsResult = yield* exists(organizationId, company.id)
      if (!existsResult) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "Company", entityId: company.id })
        )
      }

      // Convert incorporationDate Option<LocalDate> to ISO string | null for SQL
      // Use ISO strings to avoid timezone conversion issues with DATE columns
      const incorporationDateValue = Option.getOrNull(
        Option.map(company.incorporationDate, (ld) => ld.toString())
      )

      // Extract address fields
      const address = Option.getOrNull(company.registeredAddress)

      yield* sql`
        UPDATE companies SET
          name = ${company.name},
          legal_name = ${company.legalName},
          jurisdiction = ${company.jurisdiction},
          tax_id = ${Option.getOrNull(company.taxId)},
          incorporation_date = ${incorporationDateValue}::date,
          registration_number = ${Option.getOrNull(company.registrationNumber)},
          registered_address_street1 = ${address ? Option.getOrNull(address.street1) : null},
          registered_address_street2 = ${address ? Option.getOrNull(address.street2) : null},
          registered_address_city = ${address ? Option.getOrNull(address.city) : null},
          registered_address_state = ${address ? Option.getOrNull(address.state) : null},
          registered_address_postal_code = ${address ? Option.getOrNull(address.postalCode) : null},
          registered_address_country = ${address ? Option.getOrNull(address.country) : null},
          industry_code = ${Option.getOrNull(company.industryCode)},
          company_type = ${Option.getOrNull(company.companyType)},
          incorporation_jurisdiction = ${Option.getOrNull(company.incorporationJurisdiction)},
          functional_currency = ${company.functionalCurrency},
          reporting_currency = ${company.reportingCurrency},
          fiscal_year_end_month = ${company.fiscalYearEnd.month},
          fiscal_year_end_day = ${company.fiscalYearEnd.day},
          retained_earnings_account_id = ${Option.getOrNull(company.retainedEarningsAccountId)},
          is_active = ${company.isActive}
        WHERE id = ${company.id} AND organization_id = ${organizationId}
      `.pipe(wrapSqlError("update"))

      return company
    })

  const getById: CompanyRepositoryService["getById"] = (organizationId, id) =>
    Effect.gen(function* () {
      const maybeCompany = yield* findById(organizationId, id)
      return yield* Option.match(maybeCompany, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "Company", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findActiveByOrganization: CompanyRepositoryService["findActiveByOrganization"] = (organizationId) =>
    findActiveCompaniesByOrganization(organizationId).pipe(
      Effect.map((rows) => rows.map(rowToCompany)),
      wrapSqlError("findActiveByOrganization")
    )

  const exists: CompanyRepositoryService["exists"] = (organizationId, id) =>
    countByOrgAndId({ organizationId, id }).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("exists")
    )

  return {
    findById,
    findByOrganization,
    create,
    update,
    getById,
    findActiveByOrganization,
    exists
  } satisfies CompanyRepositoryService
})

/**
 * CompanyRepositoryLive - Layer providing CompanyRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 */
export const CompanyRepositoryLive = Layer.effect(CompanyRepository, make)
