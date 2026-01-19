/**
 * PolicyRepositoryLive - PostgreSQL implementation of PolicyRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module PolicyRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { AuthorizationPolicy } from "@accountability/core/authorization/AuthorizationPolicy"
import { PolicyId } from "@accountability/core/authorization/PolicyId"
import type { PolicyEffect } from "@accountability/core/authorization/PolicyEffect"
import type {
  SubjectCondition,
  ResourceCondition,
  ActionCondition,
  EnvironmentCondition
} from "@accountability/core/authorization/PolicyConditions"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import {
  PolicyRepository,
  type PolicyRepositoryService,
  SystemPolicyProtectionError
} from "../Services/PolicyRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from organization_policies table
 */
const PolicyRow = Schema.Struct({
  id: Schema.String,
  organization_id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  subject_condition: Schema.Unknown,
  resource_condition: Schema.Unknown,
  action_condition: Schema.Unknown,
  environment_condition: Schema.NullOr(Schema.Unknown),
  effect: Schema.String,
  priority: Schema.Number,
  is_system_policy: Schema.Boolean,
  is_active: Schema.Boolean,
  created_at: Schema.DateFromSelf,
  updated_at: Schema.DateFromSelf,
  created_by: Schema.NullOr(Schema.String)
})
type PolicyRow = typeof PolicyRow.Type

/**
 * Map effect string to PolicyEffect type
 */
const EFFECT_MAP: Record<string, PolicyEffect> = {
  allow: "allow",
  deny: "deny"
}

/**
 * Valid resource types for policy conditions
 */
type PolicyResourceType = "organization" | "company" | "account" | "journal_entry" | "fiscal_period" | "consolidation_group" | "report" | "*"

const RESOURCE_TYPE_MAP: Record<string, PolicyResourceType> = {
  organization: "organization",
  company: "company",
  account: "account",
  journal_entry: "journal_entry",
  fiscal_period: "fiscal_period",
  consolidation_group: "consolidation_group",
  report: "report",
  "*": "*"
}

/**
 * Parse JSONB to typed condition using identity pattern to avoid type assertions
 */
const identitySubject = (x: SubjectCondition): SubjectCondition => x
const identityAction = (x: ActionCondition): ActionCondition => x
const identityEnvironment = (x: EnvironmentCondition): EnvironmentCondition => x

const parseSubjectCondition = (jsonb: unknown): SubjectCondition => {
  if (typeof jsonb !== "object" || jsonb === null) return {}
  // Use identity pattern - the JSONB comes from DB where we stored typed data
  return identitySubject(Object.assign({}, jsonb))
}

/**
 * Helper to extract type safely from JSONB
 */
const getResourceTypeFromJsonb = (jsonb: object): PolicyResourceType => {
  if (!("type" in jsonb)) return "*"
  const typeValue = jsonb.type
  if (typeof typeValue !== "string") return "*"
  return RESOURCE_TYPE_MAP[typeValue] ?? "*"
}

/**
 * Helper to extract attributes safely from JSONB
 */
const identityResourceAttributes = (x: ResourceCondition["attributes"]): ResourceCondition["attributes"] => x

const getResourceAttributesFromJsonb = (jsonb: object): ResourceCondition["attributes"] | undefined => {
  if (!("attributes" in jsonb)) return undefined
  if (jsonb.attributes == null) return undefined
  return identityResourceAttributes(Object.assign({}, jsonb.attributes))
}

const parseResourceCondition = (jsonb: unknown): ResourceCondition => {
  if (typeof jsonb !== "object" || jsonb === null) return { type: "*" }
  const resourceType = getResourceTypeFromJsonb(jsonb)
  const attributes = getResourceAttributesFromJsonb(jsonb)

  if (attributes != null) {
    return { type: resourceType, attributes }
  }
  return { type: resourceType }
}

const parseActionCondition = (jsonb: unknown): ActionCondition => {
  if (typeof jsonb !== "object" || jsonb === null) return { actions: [] }
  const obj = Object.assign({ actions: [] }, jsonb)
  return identityAction(obj)
}

const parseEnvironmentCondition = (jsonb: unknown): EnvironmentCondition | undefined => {
  if (typeof jsonb !== "object" || jsonb === null) return undefined
  return identityEnvironment(Object.assign({}, jsonb))
}

/**
 * Convert database row to AuthorizationPolicy domain entity
 */
const rowToPolicy = (row: PolicyRow): AuthorizationPolicy =>
  AuthorizationPolicy.make({
    id: PolicyId.make(row.id),
    organizationId: OrganizationId.make(row.organization_id),
    name: row.name,
    description: Option.fromNullable(row.description),
    subject: parseSubjectCondition(row.subject_condition),
    resource: parseResourceCondition(row.resource_condition),
    action: parseActionCondition(row.action_condition),
    environment: Option.fromNullable(parseEnvironmentCondition(row.environment_condition)),
    effect: EFFECT_MAP[row.effect] ?? "deny",
    priority: row.priority,
    isSystemPolicy: row.is_system_policy,
    isActive: row.is_active,
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    updatedAt: Timestamp.make({ epochMillis: row.updated_at.getTime() }),
    createdBy: Option.fromNullable(row.created_by).pipe(Option.map(AuthUserId.make))
  })

/**
 * Implementation of PolicyRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  const findPolicyById = SqlSchema.findOne({
    Request: Schema.String,
    Result: PolicyRow,
    execute: (id) => sql`SELECT * FROM organization_policies WHERE id = ${id}`
  })

  const findPoliciesByOrganization = SqlSchema.findAll({
    Request: Schema.String,
    Result: PolicyRow,
    execute: (organizationId) => sql`
      SELECT * FROM organization_policies
      WHERE organization_id = ${organizationId}
      ORDER BY priority DESC, created_at
    `
  })

  const findActivePoliciesByOrganization = SqlSchema.findAll({
    Request: Schema.String,
    Result: PolicyRow,
    execute: (organizationId) => sql`
      SELECT * FROM organization_policies
      WHERE organization_id = ${organizationId} AND is_active = true
      ORDER BY priority DESC, created_at
    `
  })

  const findById: PolicyRepositoryService["findById"] = (id) =>
    findPolicyById(id).pipe(
      Effect.map(Option.map(rowToPolicy)),
      wrapSqlError("findById")
    )

  const findByOrganization: PolicyRepositoryService["findByOrganization"] = (organizationId) =>
    findPoliciesByOrganization(organizationId).pipe(
      Effect.map((rows) => rows.map(rowToPolicy)),
      wrapSqlError("findByOrganization")
    )

  const findActiveByOrganization: PolicyRepositoryService["findActiveByOrganization"] = (organizationId) =>
    findActivePoliciesByOrganization(organizationId).pipe(
      Effect.map((rows) => rows.map(rowToPolicy)),
      wrapSqlError("findActiveByOrganization")
    )

  const create: PolicyRepositoryService["create"] = (input) =>
    Effect.gen(function* () {
      const now = new Date()
      const subjectJson = JSON.stringify(input.subject)
      const resourceJson = JSON.stringify(input.resource)
      const actionJson = JSON.stringify(input.action)
      const environmentJson = input.environment ? JSON.stringify(input.environment) : null

      yield* sql`
        INSERT INTO organization_policies (
          id, organization_id, name, description,
          subject_condition, resource_condition, action_condition, environment_condition,
          effect, priority, is_system_policy, is_active,
          created_at, updated_at, created_by
        ) VALUES (
          ${input.id},
          ${input.organizationId},
          ${input.name},
          ${input.description ?? null},
          ${subjectJson}::jsonb,
          ${resourceJson}::jsonb,
          ${actionJson}::jsonb,
          ${environmentJson}::jsonb,
          ${input.effect}::policy_effect,
          ${input.priority},
          ${input.isSystemPolicy ?? false},
          ${input.isActive ?? true},
          ${now},
          ${now},
          ${input.createdBy ?? null}
        )
      `.pipe(wrapSqlError("create"))

      // Return the created policy - refetch to get full row
      const maybeCreated = yield* findById(input.id)
      return yield* Option.match(maybeCreated, {
        onNone: () => Effect.die(new Error(`Failed to fetch created policy: ${input.id}`)),
        onSome: Effect.succeed
      })
    })

  const update: PolicyRepositoryService["update"] = (id, changes) =>
    Effect.gen(function* () {
      // Check if policy exists and is not a system policy
      const maybePolicy = yield* findById(id)
      if (Option.isNone(maybePolicy)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "AuthorizationPolicy", entityId: id })
        )
      }

      const policy = maybePolicy.value
      if (policy.isSystemPolicy) {
        return yield* Effect.fail(new SystemPolicyProtectionError(id, "update"))
      }

      // Update each field that changed
      if (changes.name !== undefined) {
        yield* sql`
          UPDATE organization_policies SET name = ${changes.name} WHERE id = ${id}
        `.pipe(wrapSqlError("update.name"))
      }
      if (changes.description !== undefined) {
        yield* sql`
          UPDATE organization_policies SET description = ${changes.description} WHERE id = ${id}
        `.pipe(wrapSqlError("update.description"))
      }
      if (changes.subject !== undefined) {
        const subjectJson = JSON.stringify(changes.subject)
        yield* sql`
          UPDATE organization_policies SET subject_condition = ${subjectJson}::jsonb WHERE id = ${id}
        `.pipe(wrapSqlError("update.subject"))
      }
      if (changes.resource !== undefined) {
        const resourceJson = JSON.stringify(changes.resource)
        yield* sql`
          UPDATE organization_policies SET resource_condition = ${resourceJson}::jsonb WHERE id = ${id}
        `.pipe(wrapSqlError("update.resource"))
      }
      if (changes.action !== undefined) {
        const actionJson = JSON.stringify(changes.action)
        yield* sql`
          UPDATE organization_policies SET action_condition = ${actionJson}::jsonb WHERE id = ${id}
        `.pipe(wrapSqlError("update.action"))
      }
      if (changes.environment !== undefined) {
        const environmentJson = changes.environment ? JSON.stringify(changes.environment) : null
        yield* sql`
          UPDATE organization_policies SET environment_condition = ${environmentJson}::jsonb WHERE id = ${id}
        `.pipe(wrapSqlError("update.environment"))
      }
      if (changes.effect !== undefined) {
        yield* sql`
          UPDATE organization_policies SET effect = ${changes.effect}::policy_effect WHERE id = ${id}
        `.pipe(wrapSqlError("update.effect"))
      }
      if (changes.priority !== undefined) {
        yield* sql`
          UPDATE organization_policies SET priority = ${changes.priority} WHERE id = ${id}
        `.pipe(wrapSqlError("update.priority"))
      }
      if (changes.isActive !== undefined) {
        yield* sql`
          UPDATE organization_policies SET is_active = ${changes.isActive} WHERE id = ${id}
        `.pipe(wrapSqlError("update.isActive"))
      }

      // Return updated policy
      const updated = yield* findById(id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(new EntityNotFoundError({ entityType: "AuthorizationPolicy", entityId: id })),
            onSome: Effect.succeed
          })
        )
      )
      return updated
    })

  const deletePolicy: PolicyRepositoryService["delete"] = (id) =>
    Effect.gen(function* () {
      // Check if policy exists and is not a system policy
      const maybePolicy = yield* findById(id)
      if (Option.isNone(maybePolicy)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "AuthorizationPolicy", entityId: id })
        )
      }

      const policy = maybePolicy.value
      if (policy.isSystemPolicy) {
        return yield* Effect.fail(new SystemPolicyProtectionError(id, "delete"))
      }

      yield* sql`
        DELETE FROM organization_policies WHERE id = ${id}
      `.pipe(wrapSqlError("delete"))
    })

  const getById: PolicyRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybePolicy = yield* findById(id)
      return yield* Option.match(maybePolicy, {
        onNone: () =>
          Effect.fail(new EntityNotFoundError({ entityType: "AuthorizationPolicy", entityId: id })),
        onSome: Effect.succeed
      })
    })

  return {
    findById,
    findByOrganization,
    findActiveByOrganization,
    create,
    update,
    delete: deletePolicy,
    getById
  } satisfies PolicyRepositoryService
})

/**
 * PolicyRepositoryLive - Layer providing PolicyRepository implementation
 *
 * Requires SqlClient.SqlClient in context.
 */
export const PolicyRepositoryLive = Layer.effect(PolicyRepository, make)
