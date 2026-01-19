/**
 * CurrentUserId - Re-export from canonical location
 *
 * This file provides the new import path for CurrentUserId while maintaining
 * backward compatibility during the core package reorganization.
 *
 * @module shared/context/CurrentUserId
 */

export { CurrentUserId, getCurrentUserId, withCurrentUserId } from "../../AuditLog/CurrentUserId.ts"
