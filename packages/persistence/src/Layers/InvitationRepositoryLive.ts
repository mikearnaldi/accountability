/**
 * InvitationRepositoryLive - PostgreSQL implementation of InvitationRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * Token hashing uses SHA-256 via crypto.subtle for secure storage.
 *
 * @module InvitationRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import type { FunctionalRole } from "@accountability/core/authorization/FunctionalRole"
import { InvitationId } from "@accountability/core/membership/InvitationId"
import type { InvitationStatus } from "@accountability/core/membership/InvitationStatus"
import type { InvitationRole } from "@accountability/core/membership/OrganizationInvitation"
import { OrganizationInvitation } from "@accountability/core/membership/OrganizationInvitation"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import {
  InvitationRepository,
  type InvitationRepositoryService
} from "../Services/InvitationRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from organization_invitations table
 */
const InvitationRow = Schema.Struct({
  id: Schema.String,
  organization_id: Schema.String,
  email: Schema.String,
  role: Schema.String,
  functional_roles: Schema.Unknown, // JSONB array
  token_hash: Schema.String,
  status: Schema.String,
  accepted_at: Schema.NullOr(Schema.DateFromSelf),
  accepted_by: Schema.NullOr(Schema.String),
  revoked_at: Schema.NullOr(Schema.DateFromSelf),
  revoked_by: Schema.NullOr(Schema.String),
  created_at: Schema.DateFromSelf,
  invited_by: Schema.String
})
type InvitationRow = typeof InvitationRow.Type

/**
 * Map role string to InvitationRole type
 */
const ROLE_MAP: Record<string, InvitationRole> = {
  admin: "admin",
  member: "member",
  viewer: "viewer"
}

/**
 * Map status string to InvitationStatus type
 */
const STATUS_MAP: Record<string, InvitationStatus> = {
  pending: "pending",
  accepted: "accepted",
  revoked: "revoked"
}

/**
 * Valid functional role values for type checking
 */
const VALID_FUNCTIONAL_ROLES = new Set([
  "controller",
  "finance_manager",
  "accountant",
  "period_admin",
  "consolidation_manager"
])

/**
 * Parse functional roles from JSONB
 */
const parseFunctionalRoles = (jsonb: unknown): readonly FunctionalRole[] => {
  if (!Array.isArray(jsonb)) return []
  return jsonb.filter((r): r is FunctionalRole =>
    typeof r === "string" && VALID_FUNCTIONAL_ROLES.has(r)
  )
}

/**
 * Convert database row to OrganizationInvitation domain entity
 */
const rowToInvitation = (row: InvitationRow): OrganizationInvitation =>
  OrganizationInvitation.make({
    id: InvitationId.make(row.id),
    organizationId: OrganizationId.make(row.organization_id),
    email: row.email,
    role: ROLE_MAP[row.role] ?? "member",
    functionalRoles: parseFunctionalRoles(row.functional_roles),
    tokenHash: row.token_hash,
    status: STATUS_MAP[row.status] ?? "pending",
    acceptedAt: Option.fromNullable(row.accepted_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    ),
    acceptedBy: Option.fromNullable(row.accepted_by).pipe(Option.map(AuthUserId.make)),
    revokedAt: Option.fromNullable(row.revoked_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    ),
    revokedBy: Option.fromNullable(row.revoked_by).pipe(Option.map(AuthUserId.make)),
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    invitedBy: AuthUserId.make(row.invited_by)
  })

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Hash a token using SHA-256
 */
const hashToken = (token: string): Effect.Effect<string> =>
  Effect.promise(async () => {
    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  })

/**
 * Implementation of InvitationRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  const findInvitationById = SqlSchema.findOne({
    Request: Schema.String,
    Result: InvitationRow,
    execute: (id) => sql`SELECT * FROM organization_invitations WHERE id = ${id}`
  })

  const findInvitationByTokenHash = SqlSchema.findOne({
    Request: Schema.String,
    Result: InvitationRow,
    execute: (tokenHash) => sql`
      SELECT * FROM organization_invitations WHERE token_hash = ${tokenHash}
    `
  })

  const findInvitationsByOrganization = SqlSchema.findAll({
    Request: Schema.String,
    Result: InvitationRow,
    execute: (organizationId) => sql`
      SELECT * FROM organization_invitations
      WHERE organization_id = ${organizationId}
      ORDER BY created_at DESC
    `
  })

  const findPendingInvitationsByOrganization = SqlSchema.findAll({
    Request: Schema.String,
    Result: InvitationRow,
    execute: (organizationId) => sql`
      SELECT * FROM organization_invitations
      WHERE organization_id = ${organizationId} AND status = 'pending'
      ORDER BY created_at DESC
    `
  })

  const findPendingInvitationsByEmail = SqlSchema.findAll({
    Request: Schema.String,
    Result: InvitationRow,
    execute: (email) => sql`
      SELECT * FROM organization_invitations
      WHERE LOWER(email) = LOWER(${email}) AND status = 'pending'
      ORDER BY created_at DESC
    `
  })

  const EmailOrgInput = Schema.Struct({
    email: Schema.String,
    organizationId: Schema.String
  })

  const countPendingByEmailAndOrg = SqlSchema.single({
    Request: EmailOrgInput,
    Result: CountRow,
    execute: (input) => sql`
      SELECT COUNT(*) as count FROM organization_invitations
      WHERE LOWER(email) = LOWER(${input.email})
        AND organization_id = ${input.organizationId}
        AND status = 'pending'
    `
  })

  const create: InvitationRepositoryService["create"] = (input, rawToken) =>
    Effect.gen(function* () {
      const tokenHash = yield* hashToken(rawToken)
      const now = new Date()
      const functionalRolesJson = JSON.stringify(input.functionalRoles)

      yield* sql`
        INSERT INTO organization_invitations (
          id, organization_id, email, role, functional_roles, token_hash,
          status, created_at, invited_by
        ) VALUES (
          ${input.id},
          ${input.organizationId},
          ${input.email},
          ${input.role}::base_role,
          ${functionalRolesJson}::jsonb,
          ${tokenHash},
          'pending'::invitation_status,
          ${now},
          ${input.invitedBy}
        )
      `.pipe(wrapSqlError("create"))

      // Return the created invitation - refetch to get full row
      const maybeCreated = yield* findById(input.id)
      return yield* Option.match(maybeCreated, {
        onNone: () => Effect.die(new Error(`Failed to fetch created invitation: ${input.id}`)),
        onSome: Effect.succeed
      })
    })

  const findById: InvitationRepositoryService["findById"] = (id) =>
    findInvitationById(id).pipe(
      Effect.map(Option.map(rowToInvitation)),
      wrapSqlError("findById")
    )

  const findByTokenHash: InvitationRepositoryService["findByTokenHash"] = (tokenHash) =>
    findInvitationByTokenHash(tokenHash).pipe(
      Effect.map(Option.map(rowToInvitation)),
      wrapSqlError("findByTokenHash")
    )

  const findByOrganization: InvitationRepositoryService["findByOrganization"] = (organizationId) =>
    findInvitationsByOrganization(organizationId).pipe(
      Effect.map((rows) => rows.map(rowToInvitation)),
      wrapSqlError("findByOrganization")
    )

  const findPendingByOrganization: InvitationRepositoryService["findPendingByOrganization"] = (organizationId) =>
    findPendingInvitationsByOrganization(organizationId).pipe(
      Effect.map((rows) => rows.map(rowToInvitation)),
      wrapSqlError("findPendingByOrganization")
    )

  const findPendingByEmail: InvitationRepositoryService["findPendingByEmail"] = (email) =>
    findPendingInvitationsByEmail(email).pipe(
      Effect.map((rows) => rows.map(rowToInvitation)),
      wrapSqlError("findPendingByEmail")
    )

  const accept: InvitationRepositoryService["accept"] = (id, acceptedBy) =>
    Effect.gen(function* () {
      // Check if invitation exists
      const maybeInvitation = yield* findById(id)
      if (Option.isNone(maybeInvitation)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "OrganizationInvitation", entityId: id })
        )
      }

      const now = new Date()

      yield* sql`
        UPDATE organization_invitations
        SET
          status = 'accepted'::invitation_status,
          accepted_at = ${now},
          accepted_by = ${acceptedBy}
        WHERE id = ${id}
      `.pipe(wrapSqlError("accept"))

      // Return updated invitation
      const updated = yield* findById(id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(new EntityNotFoundError({ entityType: "OrganizationInvitation", entityId: id })),
            onSome: Effect.succeed
          })
        )
      )
      return updated
    })

  const revoke: InvitationRepositoryService["revoke"] = (id, revokedBy) =>
    Effect.gen(function* () {
      // Check if invitation exists
      const maybeInvitation = yield* findById(id)
      if (Option.isNone(maybeInvitation)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "OrganizationInvitation", entityId: id })
        )
      }

      const now = new Date()

      yield* sql`
        UPDATE organization_invitations
        SET
          status = 'revoked'::invitation_status,
          revoked_at = ${now},
          revoked_by = ${revokedBy}
        WHERE id = ${id}
      `.pipe(wrapSqlError("revoke"))

      // Return updated invitation
      const updated = yield* findById(id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(new EntityNotFoundError({ entityType: "OrganizationInvitation", entityId: id })),
            onSome: Effect.succeed
          })
        )
      )
      return updated
    })

  const getById: InvitationRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybeInvitation = yield* findById(id)
      return yield* Option.match(maybeInvitation, {
        onNone: () =>
          Effect.fail(new EntityNotFoundError({ entityType: "OrganizationInvitation", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const hasPendingInvitation: InvitationRepositoryService["hasPendingInvitation"] = (email, organizationId) =>
    countPendingByEmailAndOrg({ email, organizationId }).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("hasPendingInvitation")
    )

  return {
    create,
    findById,
    findByTokenHash,
    findByOrganization,
    findPendingByOrganization,
    findPendingByEmail,
    accept,
    revoke,
    getById,
    hasPendingInvitation
  } satisfies InvitationRepositoryService
})

/**
 * InvitationRepositoryLive - Layer providing InvitationRepository implementation
 *
 * Requires SqlClient.SqlClient in context.
 */
export const InvitationRepositoryLive = Layer.effect(InvitationRepository, make)
