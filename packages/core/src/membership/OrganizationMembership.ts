/**
 * OrganizationMembership - User membership in an organization
 *
 * Represents a user's membership in an organization, including their base role,
 * functional roles, status, and audit fields for removal/reinstatement tracking.
 *
 * @module membership/OrganizationMembership
 */

import * as Schema from "effect/Schema"
import { AuthUserId } from "../authentication/AuthUserId.ts"
import { OrganizationId } from "../organization/Organization.ts"
import { OrganizationMembershipId } from "./OrganizationMembershipId.ts"
import { BaseRole } from "../authorization/BaseRole.ts"
import { MembershipStatus } from "./MembershipStatus.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

/**
 * OrganizationMembership - A user's membership in an organization
 *
 * Tracks:
 * - Base role (owner, admin, member, viewer)
 * - Functional roles (controller, finance_manager, accountant, period_admin, consolidation_manager)
 * - Status with soft delete support (active, suspended, removed)
 * - Removal and reinstatement history
 */
export class OrganizationMembership extends Schema.Class<OrganizationMembership>(
  "OrganizationMembership"
)({
  /**
   * Unique identifier for this membership record
   */
  id: OrganizationMembershipId,

  /**
   * The user who is a member
   */
  userId: AuthUserId,

  /**
   * The organization the user is a member of
   */
  organizationId: OrganizationId,

  /**
   * Base role determining default permission set
   */
  role: BaseRole,

  /**
   * Functional role: controller - Period lock/unlock, consolidation oversight
   */
  isController: Schema.Boolean,

  /**
   * Functional role: finance_manager - Account management, exchange rates
   */
  isFinanceManager: Schema.Boolean,

  /**
   * Functional role: accountant - Journal entry operations
   */
  isAccountant: Schema.Boolean,

  /**
   * Functional role: period_admin - Period open/close operations
   */
  isPeriodAdmin: Schema.Boolean,

  /**
   * Functional role: consolidation_manager - Consolidation group management
   */
  isConsolidationManager: Schema.Boolean,

  /**
   * Current membership status
   */
  status: MembershipStatus,

  /**
   * When the member was removed (if status is 'removed')
   */
  removedAt: Schema.OptionFromNullOr(Timestamp),

  /**
   * Who removed the member
   */
  removedBy: Schema.OptionFromNullOr(AuthUserId),

  /**
   * Reason for removal
   */
  removalReason: Schema.OptionFromNullOr(Schema.String),

  /**
   * When the member was reinstated (if previously removed)
   */
  reinstatedAt: Schema.OptionFromNullOr(Timestamp),

  /**
   * Who reinstated the member
   */
  reinstatedBy: Schema.OptionFromNullOr(AuthUserId),

  /**
   * When the membership was created
   */
  createdAt: Timestamp,

  /**
   * When the membership was last updated
   */
  updatedAt: Timestamp,

  /**
   * Who invited this member (if invited via invitation flow)
   */
  invitedBy: Schema.OptionFromNullOr(AuthUserId)
}) {
  /**
   * Check if the member has a specific functional role
   */
  hasFunctionalRole(
    role:
      | "controller"
      | "finance_manager"
      | "accountant"
      | "period_admin"
      | "consolidation_manager"
  ): boolean {
    switch (role) {
      case "controller":
        return this.isController
      case "finance_manager":
        return this.isFinanceManager
      case "accountant":
        return this.isAccountant
      case "period_admin":
        return this.isPeriodAdmin
      case "consolidation_manager":
        return this.isConsolidationManager
    }
  }

  /**
   * Get all functional roles as an array
   */
  getFunctionalRoles(): Array<
    | "controller"
    | "finance_manager"
    | "accountant"
    | "period_admin"
    | "consolidation_manager"
  > {
    const roles: Array<
      | "controller"
      | "finance_manager"
      | "accountant"
      | "period_admin"
      | "consolidation_manager"
    > = []
    if (this.isController) roles.push("controller")
    if (this.isFinanceManager) roles.push("finance_manager")
    if (this.isAccountant) roles.push("accountant")
    if (this.isPeriodAdmin) roles.push("period_admin")
    if (this.isConsolidationManager) roles.push("consolidation_manager")
    return roles
  }

  /**
   * Check if the membership is active
   */
  isActive(): boolean {
    return this.status === "active"
  }

  /**
   * Check if the user is the organization owner
   */
  isOwner(): boolean {
    return this.role === "owner"
  }

  /**
   * Check if the user is an admin (owner or admin role)
   */
  isAdmin(): boolean {
    return this.role === "owner" || this.role === "admin"
  }
}

/**
 * Type guard for OrganizationMembership using Schema.is
 */
export const isOrganizationMembership = Schema.is(OrganizationMembership)
