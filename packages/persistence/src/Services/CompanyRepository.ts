/**
 * CompanyRepository - Repository interface for Company entity persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * IMPORTANT: All methods require organizationId for authorization enforcement.
 * This ensures data isolation - users can only access companies within their organization.
 *
 * @module CompanyRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type { Company, CompanyId } from "@accountability/core/company/Company"
import type { OrganizationId } from "@accountability/core/organization/Organization"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * CompanyRepository - Service interface for Company persistence
 *
 * Provides CRUD operations for Company entities with typed error handling.
 * All methods require organizationId to enforce data isolation.
 */
export interface CompanyRepositoryService {
  /**
   * Find a company by its unique identifier within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The company ID to search for
   * @returns Effect containing Option of Company (None if not found or not in org)
   */
  readonly findById: (
    organizationId: OrganizationId,
    id: CompanyId
  ) => Effect.Effect<Option.Option<Company>, PersistenceError>

  /**
   * Find all companies belonging to an organization
   *
   * @param organizationId - The organization ID to filter by
   * @returns Effect containing array of companies
   */
  readonly findByOrganization: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<Company>, PersistenceError>

  /**
   * Create a new company
   *
   * @param company - The company entity to create
   * @returns Effect containing the created company
   */
  readonly create: (
    company: Company
  ) => Effect.Effect<Company, PersistenceError>

  /**
   * Update an existing company within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param company - The company entity with updated values
   * @returns Effect containing the updated company
   * @throws EntityNotFoundError if company doesn't exist or not in org
   */
  readonly update: (
    organizationId: OrganizationId,
    company: Company
  ) => Effect.Effect<Company, EntityNotFoundError | PersistenceError>

  /**
   * Find a company by its unique identifier within an organization, throwing if not found
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The company ID to search for
   * @returns Effect containing the Company
   * @throws EntityNotFoundError if company doesn't exist or not in org
   */
  readonly getById: (
    organizationId: OrganizationId,
    id: CompanyId
  ) => Effect.Effect<Company, EntityNotFoundError | PersistenceError>

  /**
   * Find all active companies belonging to an organization
   *
   * @param organizationId - The organization ID to filter by
   * @returns Effect containing array of active companies
   */
  readonly findActiveByOrganization: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<Company>, PersistenceError>

  /**
   * Check if a company exists within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The company ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly exists: (
    organizationId: OrganizationId,
    id: CompanyId
  ) => Effect.Effect<boolean, PersistenceError>
}

/**
 * CompanyRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* CompanyRepository
 *   const company = yield* repo.findById(companyId)
 *   // ...
 * })
 * ```
 */
export class CompanyRepository extends Context.Tag("CompanyRepository")<
  CompanyRepository,
  CompanyRepositoryService
>() {}
