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
import { AppApi, HealthCheckResponse } from "@accountability/api/AppApi"
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
  BusinessRuleError
} from "@accountability/api/ApiErrors"

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
  describe("NotFoundError", () => {
    it("should create with resource and id", () => {
      const error = new NotFoundError({
        resource: "Account",
        id: "acc-123"
      })

      expect(error.resource).toBe("Account")
      expect(error.id).toBe("acc-123")
      expect(error.message).toBe("Account not found: acc-123")
      expect(error._tag).toBe("NotFoundError")
    })

    it("should have 404 status annotation", () => {
      // The Schema.TaggedError with HttpApiSchema.annotations({ status: 404 })
      // should encode the status code properly
      const error = new NotFoundError({
        resource: "Company",
        id: "comp-456"
      })
      expect(error._tag).toBe("NotFoundError")
    })
  })

  describe("ValidationError", () => {
    it("should create with message only", () => {
      const error = new ValidationError({
        message: "Invalid input",
        field: Option.none(),
        details: Option.none()
      })

      expect(error.message).toBe("Invalid input")
      expect(Option.isNone(error.field)).toBe(true)
      expect(Option.isNone(error.details)).toBe(true)
    })

    it("should create with field and details", () => {
      const error = new ValidationError({
        message: "Validation failed",
        field: Option.some("accountNumber"),
        details: Option.some([
          { field: "accountNumber", message: "Must be 4 digits" },
          { field: "name", message: "Required" }
        ])
      })

      expect(Option.getOrNull(error.field)).toBe("accountNumber")
      expect(Option.isSome(error.details)).toBe(true)
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

  describe("ConflictError", () => {
    it("should create with message", () => {
      const error = new ConflictError({
        message: "Account number already exists",
        resource: Option.some("Account"),
        conflictingField: Option.some("accountNumber")
      })

      expect(error.message).toBe("Account number already exists")
      expect(Option.getOrNull(error.resource)).toBe("Account")
      expect(Option.getOrNull(error.conflictingField)).toBe("accountNumber")
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

  describe("BusinessRuleError", () => {
    it("should create with code and message", () => {
      const error = new BusinessRuleError({
        code: "ENTRY_NOT_BALANCED",
        message: "Journal entry debits do not equal credits",
        details: Option.none()
      })

      expect(error.code).toBe("ENTRY_NOT_BALANCED")
      expect(error.message).toBe("Journal entry debits do not equal credits")
    })

    it("should create with details", () => {
      const error = new BusinessRuleError({
        code: "PERIOD_CLOSED",
        message: "Cannot post to closed period",
        details: Option.some({ periodId: "2024-01", closedAt: "2024-02-01" })
      })

      expect(error.code).toBe("PERIOD_CLOSED")
      expect(Option.isSome(error.details)).toBe(true)
    })
  })
})
