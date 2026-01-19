/**
 * PermissionMatrix - Re-export from canonical location
 *
 * This file re-exports PermissionMatrix from the authorization domain
 * for backward compatibility. Import from @accountability/core/authorization/PermissionMatrix
 * for new code.
 *
 * @deprecated Import from @accountability/core/authorization/PermissionMatrix instead
 * @module Auth/PermissionMatrix
 */

export {
  getBaseRolePermissions,
  getFunctionalRolePermissions,
  computeEffectivePermissions,
  hasPermission,
  getResourceType,
  permissionSetToArray
} from "../authorization/PermissionMatrix.ts"
