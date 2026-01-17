/**
 * AuthorizationPolicy - ABAC policy for fine-grained access control
 *
 * Represents an authorization policy that defines access rules based on
 * subject, resource, action, and optional environment conditions.
 *
 * Policies are evaluated in order of priority, with deny policies taking
 * precedence over allow policies at the same priority level.
 *
 * @module AuthorizationPolicy
 */

import * as Schema from "effect/Schema"
import { AuthUserId } from "./AuthUserId.ts"
import { OrganizationId } from "../Domains/Organization.ts"
import { PolicyId } from "./PolicyId.ts"
import { PolicyEffect } from "./PolicyEffect.ts"
import {
  SubjectCondition,
  ResourceCondition,
  ActionCondition,
  EnvironmentCondition
} from "./PolicyConditions.ts"
import { Timestamp } from "../Domains/Timestamp.ts"

/**
 * AuthorizationPolicy - An ABAC policy for controlling access
 *
 * A policy consists of:
 * - Conditions: subject, resource, action, environment
 * - Effect: allow or deny
 * - Priority: higher priority policies are evaluated first
 * - System flag: system policies cannot be modified or deleted
 */
export class AuthorizationPolicy extends Schema.Class<AuthorizationPolicy>(
  "AuthorizationPolicy"
)({
  /**
   * Unique identifier for this policy
   */
  id: PolicyId,

  /**
   * The organization this policy belongs to
   */
  organizationId: OrganizationId,

  /**
   * Human-readable name for the policy
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Name",
    description: "Human-readable name for the policy"
  }),

  /**
   * Optional description of what this policy does
   */
  description: Schema.OptionFromNullOr(Schema.String).annotations({
    title: "Description",
    description: "Optional description of what this policy does"
  }),

  /**
   * Subject condition - defines who this policy applies to
   */
  subject: SubjectCondition.annotations({
    title: "Subject",
    description: "Conditions that define who this policy applies to"
  }),

  /**
   * Resource condition - defines what resources this policy applies to
   */
  resource: ResourceCondition.annotations({
    title: "Resource",
    description: "Conditions that define what resources this policy applies to"
  }),

  /**
   * Action condition - defines what actions this policy applies to
   */
  action: ActionCondition.annotations({
    title: "Action",
    description: "Conditions that define what actions this policy applies to"
  }),

  /**
   * Environment condition - optional contextual conditions
   */
  environment: Schema.OptionFromNullOr(EnvironmentCondition).annotations({
    title: "Environment",
    description: "Optional contextual conditions (time, IP, etc.)"
  }),

  /**
   * Effect when this policy matches
   */
  effect: PolicyEffect.annotations({
    title: "Effect",
    description: "Whether to allow or deny when this policy matches"
  }),

  /**
   * Priority for conflict resolution (higher = evaluated first)
   * Default: 500, System policies use 900-1000
   */
  priority: Schema.Number.pipe(Schema.int(), Schema.between(0, 1000)).annotations(
    {
      title: "Priority",
      description:
        "Priority for conflict resolution (higher = evaluated first)"
    }
  ),

  /**
   * Whether this is a system-managed policy (cannot be modified/deleted)
   */
  isSystemPolicy: Schema.Boolean.annotations({
    title: "Is System Policy",
    description: "System policies cannot be modified or deleted"
  }),

  /**
   * Whether this policy is active
   */
  isActive: Schema.Boolean.annotations({
    title: "Is Active",
    description: "Whether this policy is currently active"
  }),

  /**
   * When the policy was created
   */
  createdAt: Timestamp,

  /**
   * When the policy was last updated
   */
  updatedAt: Timestamp,

  /**
   * Who created the policy
   */
  createdBy: Schema.OptionFromNullOr(AuthUserId)
}) {
  /**
   * Check if this policy can be modified
   */
  canModify(): boolean {
    return !this.isSystemPolicy
  }

  /**
   * Check if this policy can be deleted
   */
  canDelete(): boolean {
    return !this.isSystemPolicy
  }

  /**
   * Check if this is a deny policy
   */
  isDeny(): boolean {
    return this.effect === "deny"
  }

  /**
   * Check if this is an allow policy
   */
  isAllow(): boolean {
    return this.effect === "allow"
  }
}

/**
 * Type guard for AuthorizationPolicy using Schema.is
 */
export const isAuthorizationPolicy = Schema.is(AuthorizationPolicy)

/**
 * Default priority for user-created policies
 */
export const DEFAULT_POLICY_PRIORITY = 500

/**
 * System policy priority levels
 */
export const SYSTEM_POLICY_PRIORITIES = {
  PLATFORM_ADMIN_OVERRIDE: 1000,
  OWNER_FULL_ACCESS: 900,
  LOCKED_PERIOD_PROTECTION: 999,
  VIEWER_READ_ONLY: 100
} as const
