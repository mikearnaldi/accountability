/**
 * BaseRole - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location for this module is now: authorization/BaseRole.ts
 *
 * @module Auth/BaseRole
 * @deprecated Import from "@accountability/core/authorization/BaseRole" instead
 */

export {
  BaseRole,
  type BaseRole as BaseRoleType,
  isBaseRole,
  BaseRoleValues
} from "../authorization/BaseRole.ts"
