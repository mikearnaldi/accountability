/**
 * OrganizationMemberRepositoryLive - PostgreSQL implementation of OrganizationMemberRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module OrganizationMemberRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import type { BaseRole } from "@accountability/core/authorization/BaseRole"
import type { MembershipStatus } from "@accountability/core/membership/MembershipStatus"
import { OrganizationMembership } from "@accountability/core/membership/OrganizationMembership"
import { OrganizationMembershipId } from "@accountability/core/membership/OrganizationMembershipId"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import {
  OrganizationMemberRepository,
  type OrganizationMemberRepositoryService
} from "../Services/OrganizationMemberRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from user_organization_members table
 */
const MembershipRow = Schema.Struct({
  id: Schema.String,
  user_id: Schema.String,
  organization_id: Schema.String,
  role: Schema.String,
  is_controller: Schema.Boolean,
  is_finance_manager: Schema.Boolean,
  is_accountant: Schema.Boolean,
  is_period_admin: Schema.Boolean,
  is_consolidation_manager: Schema.Boolean,
  status: Schema.String,
  removed_at: Schema.NullOr(Schema.DateFromSelf),
  removed_by: Schema.NullOr(Schema.String),
  removal_reason: Schema.NullOr(Schema.String),
  reinstated_at: Schema.NullOr(Schema.DateFromSelf),
  reinstated_by: Schema.NullOr(Schema.String),
  created_at: Schema.DateFromSelf,
  updated_at: Schema.DateFromSelf,
  invited_by: Schema.NullOr(Schema.String)
})
type MembershipRow = typeof MembershipRow.Type

/**
 * Map role string to BaseRole type
 */
const ROLE_MAP: Record<string, BaseRole> = {
  owner: "owner",
  admin: "admin",
  member: "member",
  viewer: "viewer"
}

/**
 * Map status string to MembershipStatus type
 */
const STATUS_MAP: Record<string, MembershipStatus> = {
  active: "active",
  suspended: "suspended",
  removed: "removed"
}

/**
 * Convert database row to OrganizationMembership domain entity
 */
const rowToMembership = (row: MembershipRow): OrganizationMembership =>
  OrganizationMembership.make({
    id: OrganizationMembershipId.make(row.id),
    userId: AuthUserId.make(row.user_id),
    organizationId: OrganizationId.make(row.organization_id),
    role: ROLE_MAP[row.role] ?? "viewer",
    isController: row.is_controller,
    isFinanceManager: row.is_finance_manager,
    isAccountant: row.is_accountant,
    isPeriodAdmin: row.is_period_admin,
    isConsolidationManager: row.is_consolidation_manager,
    status: STATUS_MAP[row.status] ?? "active",
    removedAt: Option.fromNullable(row.removed_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    ),
    removedBy: Option.fromNullable(row.removed_by).pipe(Option.map(AuthUserId.make)),
    removalReason: Option.fromNullable(row.removal_reason),
    reinstatedAt: Option.fromNullable(row.reinstated_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    ),
    reinstatedBy: Option.fromNullable(row.reinstated_by).pipe(Option.map(AuthUserId.make)),
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    updatedAt: Timestamp.make({ epochMillis: row.updated_at.getTime() }),
    invitedBy: Option.fromNullable(row.invited_by).pipe(Option.map(AuthUserId.make))
  })

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Implementation of OrganizationMemberRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  const findMembershipById = SqlSchema.findOne({
    Request: Schema.String,
    Result: MembershipRow,
    execute: (id) => sql`SELECT * FROM user_organization_members WHERE id = ${id}`
  })

  const findMembershipsByOrganization = SqlSchema.findAll({
    Request: Schema.String,
    Result: MembershipRow,
    execute: (organizationId) => sql`
      SELECT * FROM user_organization_members
      WHERE organization_id = ${organizationId}
      ORDER BY created_at
    `
  })

  const findActiveMembershipsByOrganization = SqlSchema.findAll({
    Request: Schema.String,
    Result: MembershipRow,
    execute: (organizationId) => sql`
      SELECT * FROM user_organization_members
      WHERE organization_id = ${organizationId} AND status = 'active'
      ORDER BY created_at
    `
  })

  const findMembershipsByUser = SqlSchema.findAll({
    Request: Schema.String,
    Result: MembershipRow,
    execute: (userId) => sql`
      SELECT * FROM user_organization_members
      WHERE user_id = ${userId}
      ORDER BY created_at
    `
  })

  const findActiveMembershipsByUser = SqlSchema.findAll({
    Request: Schema.String,
    Result: MembershipRow,
    execute: (userId) => sql`
      SELECT * FROM user_organization_members
      WHERE user_id = ${userId} AND status = 'active'
      ORDER BY created_at
    `
  })

  const FindByUserAndOrgInput = Schema.Struct({
    userId: Schema.String,
    organizationId: Schema.String
  })

  const findMembershipByUserAndOrg = SqlSchema.findOne({
    Request: FindByUserAndOrgInput,
    Result: MembershipRow,
    execute: (input) => sql`
      SELECT * FROM user_organization_members
      WHERE user_id = ${input.userId} AND organization_id = ${input.organizationId}
    `
  })

  const findOwnerByOrganization = SqlSchema.findOne({
    Request: Schema.String,
    Result: MembershipRow,
    execute: (organizationId) => sql`
      SELECT * FROM user_organization_members
      WHERE organization_id = ${organizationId} AND role = 'owner' AND status = 'active'
    `
  })

  const countByUserAndOrg = SqlSchema.single({
    Request: FindByUserAndOrgInput,
    Result: CountRow,
    execute: (input) => sql`
      SELECT COUNT(*) as count FROM user_organization_members
      WHERE user_id = ${input.userId}
        AND organization_id = ${input.organizationId}
        AND status = 'active'
    `
  })

  const findById: OrganizationMemberRepositoryService["findById"] = (id) =>
    findMembershipById(id).pipe(
      Effect.map(Option.map(rowToMembership)),
      wrapSqlError("findById")
    )

  const findByOrganization: OrganizationMemberRepositoryService["findByOrganization"] = (organizationId) =>
    findMembershipsByOrganization(organizationId).pipe(
      Effect.map((rows) => rows.map(rowToMembership)),
      wrapSqlError("findByOrganization")
    )

  const findActiveByOrganization: OrganizationMemberRepositoryService["findActiveByOrganization"] = (organizationId) =>
    findActiveMembershipsByOrganization(organizationId).pipe(
      Effect.map((rows) => rows.map(rowToMembership)),
      wrapSqlError("findActiveByOrganization")
    )

  const findByUser: OrganizationMemberRepositoryService["findByUser"] = (userId) =>
    findMembershipsByUser(userId).pipe(
      Effect.map((rows) => rows.map(rowToMembership)),
      wrapSqlError("findByUser")
    )

  const findActiveByUser: OrganizationMemberRepositoryService["findActiveByUser"] = (userId) =>
    findActiveMembershipsByUser(userId).pipe(
      Effect.map((rows) => rows.map(rowToMembership)),
      wrapSqlError("findActiveByUser")
    )

  const findByUserAndOrganization: OrganizationMemberRepositoryService["findByUserAndOrganization"] = (
    userId,
    organizationId
  ) =>
    findMembershipByUserAndOrg({ userId, organizationId }).pipe(
      Effect.map(Option.map(rowToMembership)),
      wrapSqlError("findByUserAndOrganization")
    )

  const create: OrganizationMemberRepositoryService["create"] = (membership) =>
    Effect.gen(function* () {
      yield* sql`
        INSERT INTO user_organization_members (
          id, user_id, organization_id, role,
          is_controller, is_finance_manager, is_accountant, is_period_admin, is_consolidation_manager,
          status, removed_at, removed_by, removal_reason,
          reinstated_at, reinstated_by, created_at, updated_at, invited_by
        ) VALUES (
          ${membership.id},
          ${membership.userId},
          ${membership.organizationId},
          ${membership.role}::base_role,
          ${membership.isController},
          ${membership.isFinanceManager},
          ${membership.isAccountant},
          ${membership.isPeriodAdmin},
          ${membership.isConsolidationManager},
          ${membership.status}::membership_status,
          ${Option.getOrNull(membership.removedAt)?.toDate() ?? null},
          ${Option.getOrNull(membership.removedBy)},
          ${Option.getOrNull(membership.removalReason)},
          ${Option.getOrNull(membership.reinstatedAt)?.toDate() ?? null},
          ${Option.getOrNull(membership.reinstatedBy)},
          ${membership.createdAt.toDate()},
          ${membership.updatedAt.toDate()},
          ${Option.getOrNull(membership.invitedBy)}
        )
      `.pipe(wrapSqlError("create"))

      return membership
    })

  const update: OrganizationMemberRepositoryService["update"] = (id, changes) =>
    Effect.gen(function* () {
      // First check if membership exists
      const maybeMembership = yield* findById(id)
      if (Option.isNone(maybeMembership)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })
        )
      }

      const existing = maybeMembership.value

      // Build update query dynamically based on provided changes
      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (changes.role !== undefined) {
        updates.push(`role = $${paramIndex}::base_role`)
        values.push(changes.role)
        paramIndex++
      }
      if (changes.isController !== undefined) {
        updates.push(`is_controller = $${paramIndex}`)
        values.push(changes.isController)
        paramIndex++
      }
      if (changes.isFinanceManager !== undefined) {
        updates.push(`is_finance_manager = $${paramIndex}`)
        values.push(changes.isFinanceManager)
        paramIndex++
      }
      if (changes.isAccountant !== undefined) {
        updates.push(`is_accountant = $${paramIndex}`)
        values.push(changes.isAccountant)
        paramIndex++
      }
      if (changes.isPeriodAdmin !== undefined) {
        updates.push(`is_period_admin = $${paramIndex}`)
        values.push(changes.isPeriodAdmin)
        paramIndex++
      }
      if (changes.isConsolidationManager !== undefined) {
        updates.push(`is_consolidation_manager = $${paramIndex}`)
        values.push(changes.isConsolidationManager)
        paramIndex++
      }

      // If no changes, return existing
      if (updates.length === 0) {
        return existing
      }

      // Use a simpler approach - update each field individually if changed
      if (changes.role !== undefined) {
        yield* sql`
          UPDATE user_organization_members
          SET role = ${changes.role}::base_role
          WHERE id = ${id}
        `.pipe(wrapSqlError("update.role"))
      }
      if (changes.isController !== undefined) {
        yield* sql`
          UPDATE user_organization_members
          SET is_controller = ${changes.isController}
          WHERE id = ${id}
        `.pipe(wrapSqlError("update.isController"))
      }
      if (changes.isFinanceManager !== undefined) {
        yield* sql`
          UPDATE user_organization_members
          SET is_finance_manager = ${changes.isFinanceManager}
          WHERE id = ${id}
        `.pipe(wrapSqlError("update.isFinanceManager"))
      }
      if (changes.isAccountant !== undefined) {
        yield* sql`
          UPDATE user_organization_members
          SET is_accountant = ${changes.isAccountant}
          WHERE id = ${id}
        `.pipe(wrapSqlError("update.isAccountant"))
      }
      if (changes.isPeriodAdmin !== undefined) {
        yield* sql`
          UPDATE user_organization_members
          SET is_period_admin = ${changes.isPeriodAdmin}
          WHERE id = ${id}
        `.pipe(wrapSqlError("update.isPeriodAdmin"))
      }
      if (changes.isConsolidationManager !== undefined) {
        yield* sql`
          UPDATE user_organization_members
          SET is_consolidation_manager = ${changes.isConsolidationManager}
          WHERE id = ${id}
        `.pipe(wrapSqlError("update.isConsolidationManager"))
      }

      // Return updated membership
      const updated = yield* findById(id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })),
            onSome: Effect.succeed
          })
        )
      )
      return updated
    })

  const remove: OrganizationMemberRepositoryService["remove"] = (id, removedBy, reason) =>
    Effect.gen(function* () {
      // Check if membership exists
      const maybeMembership = yield* findById(id)
      if (Option.isNone(maybeMembership)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })
        )
      }

      const now = new Date()

      yield* sql`
        UPDATE user_organization_members
        SET
          status = 'removed'::membership_status,
          removed_at = ${now},
          removed_by = ${removedBy},
          removal_reason = ${reason ?? null}
        WHERE id = ${id}
      `.pipe(wrapSqlError("remove"))

      // Return updated membership
      const updated = yield* findById(id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })),
            onSome: Effect.succeed
          })
        )
      )
      return updated
    })

  const reinstate: OrganizationMemberRepositoryService["reinstate"] = (id, reinstatedBy) =>
    Effect.gen(function* () {
      // Check if membership exists
      const maybeMembership = yield* findById(id)
      if (Option.isNone(maybeMembership)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })
        )
      }

      const now = new Date()

      yield* sql`
        UPDATE user_organization_members
        SET
          status = 'active'::membership_status,
          reinstated_at = ${now},
          reinstated_by = ${reinstatedBy}
        WHERE id = ${id}
      `.pipe(wrapSqlError("reinstate"))

      // Return updated membership
      const updated = yield* findById(id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })),
            onSome: Effect.succeed
          })
        )
      )
      return updated
    })

  const suspend: OrganizationMemberRepositoryService["suspend"] = (id, suspendedBy, reason) =>
    Effect.gen(function* () {
      // Check if membership exists
      const maybeMembership = yield* findById(id)
      if (Option.isNone(maybeMembership)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })
        )
      }

      const now = new Date()

      // Suspend the member - reuse removed_at/removed_by/removal_reason fields for suspension tracking
      // (they serve the same purpose: tracking who made the status change and why)
      yield* sql`
        UPDATE user_organization_members
        SET
          status = 'suspended'::membership_status,
          removed_at = ${now},
          removed_by = ${suspendedBy},
          removal_reason = ${reason ?? null}
        WHERE id = ${id}
      `.pipe(wrapSqlError("suspend"))

      // Return updated membership
      const updated = yield* findById(id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })),
            onSome: Effect.succeed
          })
        )
      )
      return updated
    })

  const unsuspend: OrganizationMemberRepositoryService["unsuspend"] = (id, unsuspendedBy) =>
    Effect.gen(function* () {
      // Check if membership exists
      const maybeMembership = yield* findById(id)
      if (Option.isNone(maybeMembership)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })
        )
      }

      const now = new Date()

      // Unsuspend uses the reinstated_at/reinstated_by fields to track restoration
      yield* sql`
        UPDATE user_organization_members
        SET
          status = 'active'::membership_status,
          reinstated_at = ${now},
          reinstated_by = ${unsuspendedBy}
        WHERE id = ${id}
      `.pipe(wrapSqlError("unsuspend"))

      // Return updated membership
      const updated = yield* findById(id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })),
            onSome: Effect.succeed
          })
        )
      )
      return updated
    })

  const getById: OrganizationMemberRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybeMembership = yield* findById(id)
      return yield* Option.match(maybeMembership, {
        onNone: () =>
          Effect.fail(new EntityNotFoundError({ entityType: "OrganizationMembership", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const isMember: OrganizationMemberRepositoryService["isMember"] = (userId, organizationId) =>
    countByUserAndOrg({ userId, organizationId }).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("isMember")
    )

  const findOwner: OrganizationMemberRepositoryService["findOwner"] = (organizationId) =>
    findOwnerByOrganization(organizationId).pipe(
      Effect.map(Option.map(rowToMembership)),
      wrapSqlError("findOwner")
    )

  return {
    findById,
    findByOrganization,
    findActiveByOrganization,
    findByUser,
    findActiveByUser,
    findByUserAndOrganization,
    create,
    update,
    remove,
    reinstate,
    suspend,
    unsuspend,
    getById,
    isMember,
    findOwner
  } satisfies OrganizationMemberRepositoryService
})

/**
 * OrganizationMemberRepositoryLive - Layer providing OrganizationMemberRepository implementation
 *
 * Requires SqlClient.SqlClient in context.
 */
export const OrganizationMemberRepositoryLive = Layer.effect(OrganizationMemberRepository, make)
