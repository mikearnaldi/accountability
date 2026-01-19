/**
 * AuditLog - Re-export from canonical location
 *
 * This file provides the new import path for AuditLog domain entities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module audit/AuditLog
 */

export * from "../Domains/AuditLog.ts"
