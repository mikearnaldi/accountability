/**
 * AuditLog - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location for this module is now: audit/AuditLog.ts
 *
 * @module Domains/AuditLog
 * @deprecated Import from "@accountability/core/audit/AuditLog" instead
 */

export * from "../audit/AuditLog.ts"
