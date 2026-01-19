/**
 * OrganizationErrors - Domain errors for Organization domain
 *
 * These errors are used for Organization-related operations and include
 * HttpApiSchema annotations for automatic HTTP status code mapping.
 *
 * @module organization/OrganizationErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Not Found Errors (404)
// =============================================================================

/**
 * OrganizationNotFoundError - Organization does not exist
 */
export class OrganizationNotFoundError extends Schema.TaggedError<OrganizationNotFoundError>()(
  "OrganizationNotFoundError",
  {
    organizationId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Organization not found: ${this.organizationId}`
  }
}

export const isOrganizationNotFoundError = Schema.is(OrganizationNotFoundError)

// =============================================================================
// Validation Errors (400)
// =============================================================================

/**
 * InvalidOrganizationIdError - Invalid organization ID format
 */
export class InvalidOrganizationIdError extends Schema.TaggedError<InvalidOrganizationIdError>()(
  "InvalidOrganizationIdError",
  {
    value: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid organization ID format: ${this.value}`
  }
}

export const isInvalidOrganizationIdError = Schema.is(InvalidOrganizationIdError)

/**
 * UserNotMemberOfOrganizationError - User is not a member of the organization
 */
export class UserNotMemberOfOrganizationError extends Schema.TaggedError<UserNotMemberOfOrganizationError>()(
  "UserNotMemberOfOrganizationError",
  {
    userId: Schema.String,
    organizationId: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `User ${this.userId} is not a member of organization ${this.organizationId}`
  }
}

export const isUserNotMemberOfOrganizationError = Schema.is(UserNotMemberOfOrganizationError)

// =============================================================================
// Conflict Errors (409)
// =============================================================================

/**
 * OrganizationHasCompaniesError - Cannot delete organization with companies
 */
export class OrganizationHasCompaniesError extends Schema.TaggedError<OrganizationHasCompaniesError>()(
  "OrganizationHasCompaniesError",
  {
    organizationId: Schema.String,
    companyCount: Schema.Number
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Cannot delete organization with ${this.companyCount} companies. Delete or move companies first.`
  }
}

export const isOrganizationHasCompaniesError = Schema.is(OrganizationHasCompaniesError)

/**
 * OrganizationNameAlreadyExistsError - Organization name already exists
 */
export class OrganizationNameAlreadyExistsError extends Schema.TaggedError<OrganizationNameAlreadyExistsError>()(
  "OrganizationNameAlreadyExistsError",
  {
    name: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Organization with name '${this.name}' already exists`
  }
}

export const isOrganizationNameAlreadyExistsError = Schema.is(OrganizationNameAlreadyExistsError)

/**
 * OrganizationUpdateFailedError - Failed to update organization
 */
export class OrganizationUpdateFailedError extends Schema.TaggedError<OrganizationUpdateFailedError>()(
  "OrganizationUpdateFailedError",
  {
    organizationId: Schema.String,
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Failed to update organization ${this.organizationId}: ${this.reason}`
  }
}

export const isOrganizationUpdateFailedError = Schema.is(OrganizationUpdateFailedError)

// =============================================================================
// Business Rule Errors (422)
// =============================================================================

/**
 * MembershipCreationFailedError - Failed to create membership for organization creator
 */
export class MembershipCreationFailedError extends Schema.TaggedError<MembershipCreationFailedError>()(
  "MembershipCreationFailedError",
  {
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Failed to create owner membership: ${this.reason}`
  }
}

export const isMembershipCreationFailedError = Schema.is(MembershipCreationFailedError)

/**
 * SystemPolicySeedingFailedError - Failed to seed system policies for organization
 */
export class SystemPolicySeedingFailedError extends Schema.TaggedError<SystemPolicySeedingFailedError>()(
  "SystemPolicySeedingFailedError",
  {},
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return "Failed to seed system policies for organization"
  }
}

export const isSystemPolicySeedingFailedError = Schema.is(SystemPolicySeedingFailedError)
