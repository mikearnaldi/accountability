/**
 * BaseRole - Re-export from canonical location
 *
 * This file provides the new import path for BaseRole value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/BaseRole
 */

export {
  BaseRole,
  type BaseRole as BaseRoleType,
  isBaseRole,
  BaseRoleValues
} from "../Auth/BaseRole.ts"
