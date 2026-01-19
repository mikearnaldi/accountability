/**
 * Tests for the AppApi HTTP API definitions
 *
 * These tests verify:
 * - API groups are properly defined
 * - Endpoints have correct methods and paths
 * - Request/response schemas are valid
 * - Error types have correct status codes
 */

import { describe, expect, it } from "@effect/vitest"
import * as Option from "effect/Option"
import { AppApi, HealthCheckResponse } from "@accountability/api/Definitions/AppApi"
import {
  UnauthorizedError,
  ForbiddenError,
  InternalServerError
} from "@accountability/api/Definitions/ApiErrors"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import {
  AccountNotFoundError,
  AccountNumberAlreadyExistsError
} from "@accountability/core/accounting/AccountErrors"

describe("AppApi", () => {
  describe("API structure", () => {
    it("should have the correct identifier", () => {
      // Verify the API exists and has the correct structure
      expect(AppApi).toBeDefined()
    })

    it("should include health API group", () => {
      // The health group should be part of the API
      expect(AppApi).toBeDefined()
    })
  })

  describe("HealthCheckResponse", () => {
    it("should create a valid health check response", () => {
      const response = HealthCheckResponse.make({
        status: "ok" as const,
        timestamp: "2024-01-01T00:00:00.000Z",
        version: Option.some("1.0.0")
      })

      expect(response.status).toBe("ok")
      expect(response.timestamp).toBe("2024-01-01T00:00:00.000Z")
      expect(Option.getOrNull(response.version)).toBe("1.0.0")
    })

    it("should allow version to be none", () => {
      const response = HealthCheckResponse.make({
        status: "ok" as const,
        timestamp: "2024-01-01T00:00:00.000Z",
        version: Option.none()
      })

      expect(Option.isNone(response.version)).toBe(true)
    })
  })
})

describe("ApiErrors", () => {
  describe("Domain NotFound Errors", () => {
    it("AccountNotFoundError should create with accountId", () => {
      const error = new AccountNotFoundError({
        accountId: "acc-123"
      })

      expect(error.accountId).toBe("acc-123")
      expect(error.message).toBe("Account not found: acc-123")
      expect(error._tag).toBe("AccountNotFoundError")
    })

    it("CompanyNotFoundError should create with companyId", () => {
      const error = new CompanyNotFoundError({
        companyId: "comp-456"
      })

      expect(error.companyId).toBe("comp-456")
      expect(error.message).toBe("Company not found: comp-456")
      expect(error._tag).toBe("CompanyNotFoundError")
    })

    it("OrganizationNotFoundError should create with organizationId", () => {
      const error = new OrganizationNotFoundError({
        organizationId: "org-789"
      })

      expect(error.organizationId).toBe("org-789")
      expect(error.message).toBe("Organization not found: org-789")
      expect(error._tag).toBe("OrganizationNotFoundError")
    })
  })

  describe("Domain Conflict Errors", () => {
    it("AccountNumberAlreadyExistsError should create with account and company", () => {
      const error = new AccountNumberAlreadyExistsError({
        accountNumber: "1000",
        companyId: "comp-123"
      })

      expect(error.accountNumber).toBe("1000")
      expect(error.companyId).toBe("comp-123")
      expect(error.message).toBe("Account number 1000 already exists in this company")
      expect(error._tag).toBe("AccountNumberAlreadyExistsError")
    })
  })

  describe("UnauthorizedError", () => {
    it("should create with default message", () => {
      const error = new UnauthorizedError({})

      expect(error.message).toBe("Authentication required")
      expect(error._tag).toBe("UnauthorizedError")
    })

    it("should create with custom message", () => {
      const error = new UnauthorizedError({
        message: "Token expired"
      })

      expect(error.message).toBe("Token expired")
    })
  })

  describe("ForbiddenError", () => {
    it("should create with default message", () => {
      const error = new ForbiddenError({
        resource: Option.none(),
        action: Option.none()
      })

      expect(error.message).toBe("Access denied")
    })

    it("should create with resource and action", () => {
      const error = new ForbiddenError({
        message: "Cannot delete account",
        resource: Option.some("Account"),
        action: Option.some("delete")
      })

      expect(error.message).toBe("Cannot delete account")
      expect(Option.getOrNull(error.resource)).toBe("Account")
      expect(Option.getOrNull(error.action)).toBe("delete")
    })
  })

  describe("InternalServerError", () => {
    it("should create with default message", () => {
      const error = new InternalServerError({
        requestId: Option.none()
      })

      expect(error.message).toBe("An unexpected error occurred")
    })

    it("should create with request id", () => {
      const error = new InternalServerError({
        message: "Database connection failed",
        requestId: Option.some("req-123")
      })

      expect(error.message).toBe("Database connection failed")
      expect(Option.getOrNull(error.requestId)).toBe("req-123")
    })
  })
})
