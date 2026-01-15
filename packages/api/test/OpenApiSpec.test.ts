/**
 * OpenAPI Specification Generation Tests
 *
 * Verifies that the OpenAPI specification can be generated without errors
 * for all API endpoints and that all schemas have valid JSON Schema representations.
 *
 * @module OpenApiSpec.test
 */

import { describe, expect, it } from "@effect/vitest"
import { OpenApi } from "@effect/platform"
import { AppApi } from "@accountability/api/Definitions/AppApi"

describe("OpenAPI Specification", () => {
  describe("Generation", () => {
    it("generates OpenAPI spec without errors", () => {
      const spec = OpenApi.fromApi(AppApi)

      expect(spec).toBeDefined()
      expect(spec.openapi).toBe("3.1.0")
    })

    it("generates valid info section", () => {
      const spec = OpenApi.fromApi(AppApi)

      expect(spec.info).toBeDefined()
      expect(spec.info.title).toBe("Accountability API")
      expect(spec.info.version).toBe("0.0.1")
      expect(spec.info.description).toBe("Multi-company, multi-currency accounting application API")
    })
  })

  describe("API Groups", () => {
    it("includes all API groups as tags", () => {
      const spec = OpenApi.fromApi(AppApi)

      const tagNames = spec.tags.map((tag) => tag.name)

      // All API groups should be represented as tags
      expect(tagNames).toContain("Health")
      expect(tagNames).toContain("Authentication")
      expect(tagNames).toContain("Authentication (Session)")
      expect(tagNames).toContain("Accounts")
      expect(tagNames).toContain("Companies")
      expect(tagNames).toContain("Journal Entries")
      expect(tagNames).toContain("Reports")
      expect(tagNames).toContain("Currency & Exchange Rates")
      // NOTE: "Fiscal Periods" removed - periods now computed at runtime
      expect(tagNames).toContain("Intercompany Transactions")
      expect(tagNames).toContain("Consolidation")
      expect(tagNames).toContain("Elimination Rules")
    })

    it("all tags have descriptions", () => {
      const spec = OpenApi.fromApi(AppApi)

      for (const tag of spec.tags) {
        expect(tag.description, `Tag "${tag.name}" should have a description`).toBeDefined()
        expect(tag.description!.length, `Tag "${tag.name}" description should be non-empty`).toBeGreaterThan(0)
      }
    })
  })

  describe("Paths", () => {
    it("generates paths for all endpoints", () => {
      const spec = OpenApi.fromApi(AppApi)
      const paths = Object.keys(spec.paths)

      // Should have paths defined
      expect(paths.length).toBeGreaterThan(0)

      // Check for expected path prefixes
      const hasHealthPath = paths.some((p) => p.includes("/health"))
      const hasAuthPath = paths.some((p) => p.includes("/auth"))
      const hasAccountsPath = paths.some((p) => p.includes("/accounts"))
      const hasCompaniesPath = paths.some((p) => p.includes("/companies") || p.includes("/organizations"))
      const hasJournalEntriesPath = paths.some((p) => p.includes("/journal-entries"))
      const hasReportsPath = paths.some((p) => p.includes("/reports"))
      const hasExchangeRatesPath = paths.some((p) => p.includes("/exchange-rates"))
      const hasIntercompanyPath = paths.some((p) => p.includes("/intercompany-transactions"))
      const hasConsolidationPath = paths.some((p) => p.includes("/consolidation"))
      const hasEliminationRulesPath = paths.some((p) => p.includes("/elimination-rules"))

      expect(hasHealthPath, "Should have health endpoints").toBe(true)
      expect(hasAuthPath, "Should have auth endpoints").toBe(true)
      expect(hasAccountsPath, "Should have accounts endpoints").toBe(true)
      expect(hasCompaniesPath, "Should have companies/organizations endpoints").toBe(true)
      expect(hasJournalEntriesPath, "Should have journal entries endpoints").toBe(true)
      expect(hasReportsPath, "Should have reports endpoints").toBe(true)
      expect(hasExchangeRatesPath, "Should have exchange rates endpoints").toBe(true)
      // NOTE: Fiscal period endpoints removed - periods now computed at runtime
      expect(hasIntercompanyPath, "Should have intercompany transaction endpoints").toBe(true)
      expect(hasConsolidationPath, "Should have consolidation endpoints").toBe(true)
      expect(hasEliminationRulesPath, "Should have elimination rules endpoints").toBe(true)
    })

    it("all operations have operationIds", () => {
      const spec = OpenApi.fromApi(AppApi)

      const operationIds: string[] = []

      for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          expect(
            operation.operationId,
            `Operation at ${method.toUpperCase()} ${path} should have an operationId`
          ).toBeDefined()

          // Check for duplicate operationIds
          expect(
            operationIds.includes(operation.operationId),
            `Duplicate operationId: ${operation.operationId}`
          ).toBe(false)

          operationIds.push(operation.operationId)
        }
      }
    })

    it("all operations have at least one response", () => {
      const spec = OpenApi.fromApi(AppApi)

      for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          const responseCount = Object.keys(operation.responses).length
          expect(
            responseCount,
            `Operation at ${method.toUpperCase()} ${path} should have at least one response`
          ).toBeGreaterThan(0)
        }
      }
    })

    it("protected endpoints have security requirements", () => {
      const spec = OpenApi.fromApi(AppApi)

      // Public endpoints that should NOT require authentication
      const publicPaths = [
        "/health",
        "/auth/providers",
        "/auth/register",
        "/auth/login",
        "/auth/authorize",
        "/auth/callback"
      ]

      const isPublicPath = (path: string): boolean => {
        return publicPaths.some((p) => path.includes(p))
      }

      // The health endpoint should not have security
      const healthPath = Object.keys(spec.paths).find((p) => p.includes("/health"))
      if (healthPath) {
        const healthOp = spec.paths[healthPath].get
        if (healthOp) {
          expect(
            healthOp.security.length,
            "Health endpoint should not require authentication"
          ).toBe(0)
        }
      }

      // Public auth endpoints should not have security
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        if (isPublicPath(path)) {
          for (const [method, operation] of Object.entries(pathItem)) {
            expect(
              operation.security.length,
              `Public operation at ${method.toUpperCase()} ${path} should not require authentication`
            ).toBe(0)
          }
        }
      }

      // Protected endpoints should have security requirements
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        // Skip public endpoints
        if (isPublicPath(path)) continue

        for (const [method, operation] of Object.entries(pathItem)) {
          expect(
            operation.security.length,
            `Protected operation at ${method.toUpperCase()} ${path} should have security requirements`
          ).toBeGreaterThan(0)
        }
      }
    })
  })

  describe("Components", () => {
    it("generates schema definitions", () => {
      const spec = OpenApi.fromApi(AppApi)

      expect(spec.components).toBeDefined()
      expect(spec.components.schemas).toBeDefined()

      // Should have schema definitions
      const schemaCount = Object.keys(spec.components.schemas).length
      expect(schemaCount, "Should have schema definitions").toBeGreaterThan(0)
    })

    it("generates security scheme definitions", () => {
      const spec = OpenApi.fromApi(AppApi)

      expect(spec.components.securitySchemes).toBeDefined()

      // Should have bearer auth scheme
      const securitySchemes = Object.keys(spec.components.securitySchemes)
      expect(securitySchemes.length, "Should have security scheme definitions").toBeGreaterThan(0)

      // Check for bearer scheme
      const hasBearerScheme = Object.values(spec.components.securitySchemes).some(
        (scheme) => scheme.type === "http" && scheme.scheme === "bearer"
      )
      expect(hasBearerScheme, "Should have bearer authentication scheme").toBe(true)
    })

    it("all schema definitions are valid JSON Schema", () => {
      const spec = OpenApi.fromApi(AppApi)

      for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
        // Basic validation: schema should be an object
        expect(
          typeof schema,
          `Schema "${schemaName}" should be an object`
        ).toBe("object")

        // Schema should have type or $ref or oneOf/anyOf/allOf
        const hasType = "type" in schema
        const hasRef = "$ref" in schema
        const hasComposition = "oneOf" in schema || "anyOf" in schema || "allOf" in schema
        const hasConst = "const" in schema

        expect(
          hasType || hasRef || hasComposition || hasConst,
          `Schema "${schemaName}" should have type, $ref, or composition keywords`
        ).toBe(true)
      }
    })
  })

  describe("Schema References", () => {
    it("all $ref references point to existing definitions", () => {
      const spec = OpenApi.fromApi(AppApi)

      const isRecord = (x: unknown): x is Record<string, unknown> =>
        typeof x === "object" && x !== null

      const checkRefs = (obj: unknown, path: string): void => {
        if (!isRecord(obj)) return

        if ("$ref" in obj) {
          const ref = obj.$ref
          if (typeof ref === "string") {
            // Extract schema name from $ref
            const match = ref.match(/^#\/components\/schemas\/(.+)$/)
            if (match) {
              const schemaName = match[1]
              expect(
                spec.components.schemas[schemaName],
                `Reference "${ref}" at ${path} should point to existing schema`
              ).toBeDefined()
            }
          }
        }

        // Recursively check nested objects
        for (const [key, value] of Object.entries(obj)) {
          checkRefs(value, `${path}.${key}`)
        }
      }

      // Check all paths
      for (const [pathName, pathItem] of Object.entries(spec.paths)) {
        checkRefs(pathItem, `paths.${pathName}`)
      }

      // Check all schema definitions
      for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
        checkRefs(schema, `components.schemas.${schemaName}`)
      }
    })
  })

  describe("Operation Details", () => {
    it("operations have summaries or descriptions", () => {
      const spec = OpenApi.fromApi(AppApi)
      let operationsWithDocumentation = 0
      let totalOperations = 0

      for (const [, pathItem] of Object.entries(spec.paths)) {
        for (const [, operation] of Object.entries(pathItem)) {
          totalOperations++
          if (operation.summary || operation.description) {
            operationsWithDocumentation++
          }
        }
      }

      // At least 90% of operations should have documentation
      const documentationRatio = operationsWithDocumentation / totalOperations
      expect(
        documentationRatio,
        `${Math.round(documentationRatio * 100)}% of operations have summaries/descriptions, expected at least 90%`
      ).toBeGreaterThanOrEqual(0.9)
    })

    it("request bodies have content schemas", () => {
      const spec = OpenApi.fromApi(AppApi)

      for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (operation.requestBody) {
            expect(
              operation.requestBody.content,
              `Request body at ${method.toUpperCase()} ${path} should have content`
            ).toBeDefined()

            // Should have at least one content type
            const contentTypes = Object.keys(operation.requestBody.content)
            expect(
              contentTypes.length,
              `Request body at ${method.toUpperCase()} ${path} should have at least one content type`
            ).toBeGreaterThan(0)

            // Each content type should have a schema
            for (const [contentType, mediaType] of Object.entries(operation.requestBody.content)) {
              expect(
                mediaType.schema,
                `Content type "${contentType}" at ${method.toUpperCase()} ${path} should have a schema`
              ).toBeDefined()
            }
          }
        }
      }
    })

    it("path parameters are correctly defined", () => {
      const spec = OpenApi.fromApi(AppApi)

      for (const [path, pathItem] of Object.entries(spec.paths)) {
        // Extract path parameters from the path string
        const pathParams = path.match(/\{(\w+)\}/g)?.map((p) => p.slice(1, -1)) ?? []

        for (const [method, operation] of Object.entries(pathItem)) {
          // Get parameters defined as 'path' type
          const definedPathParams = operation.parameters
            .filter((p) => p.in === "path")
            .map((p) => p.name)

          // All path parameters should be defined
          for (const param of pathParams) {
            expect(
              definedPathParams.includes(param),
              `Path parameter "{${param}}" at ${method.toUpperCase()} ${path} should be defined in parameters`
            ).toBe(true)
          }

          // All defined path parameters should be required
          for (const param of operation.parameters) {
            if (param.in === "path") {
              expect(
                param.required,
                `Path parameter "${param.name}" at ${method.toUpperCase()} ${path} should be required`
              ).toBe(true)
            }
          }
        }
      }
    })
  })

  describe("JSON Schema Completeness", () => {
    it("generates spec without missing annotations warnings", () => {
      // This test verifies that fromApi doesn't throw or produce invalid output
      // due to missing jsonSchema annotations

      const generateSpec = () => {
        const spec = OpenApi.fromApi(AppApi)
        // Force serialization to catch any lazy evaluation issues
        return JSON.stringify(spec)
      }

      expect(generateSpec).not.toThrow()

      const specJson = generateSpec()
      expect(specJson).not.toContain("undefined")
      expect(specJson).not.toContain("null\":null")  // Intentional nulls should be serialized as {} or omitted
    })

    it("all endpoint responses have proper schema definitions", () => {
      const spec = OpenApi.fromApi(AppApi)

      for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          for (const [status, response] of Object.entries(operation.responses)) {
            // Success responses should have content (except 204 No Content)
            if (status.startsWith("2") && status !== "204") {
              // Some 2xx responses may legitimately have no body
              if (response.content) {
                for (const [contentType, mediaType] of Object.entries(response.content)) {
                  expect(
                    mediaType.schema,
                    `Response ${status} content type "${contentType}" at ${method.toUpperCase()} ${path} should have a schema`
                  ).toBeDefined()
                }
              }
            }

            // Error responses should have descriptive content
            expect(
              response.description,
              `Response ${status} at ${method.toUpperCase()} ${path} should have a description`
            ).toBeDefined()
          }
        }
      }
    })

    it("spec can be serialized to valid JSON", () => {
      const spec = OpenApi.fromApi(AppApi)

      const serialize = () => JSON.stringify(spec)
      expect(serialize).not.toThrow()

      const json = serialize()
      const parse = () => JSON.parse(json)
      expect(parse).not.toThrow()

      // Verify round-trip produces equivalent structure
      const parsed = parse()
      expect(parsed.openapi).toBe(spec.openapi)
      expect(parsed.info.title).toBe(spec.info.title)
      expect(Object.keys(parsed.paths).length).toBe(Object.keys(spec.paths).length)
    })
  })

  describe("API Coverage", () => {
    it("has expected number of endpoints", () => {
      const spec = OpenApi.fromApi(AppApi)

      let totalEndpoints = 0
      for (const pathItem of Object.values(spec.paths)) {
        totalEndpoints += Object.keys(pathItem).length
      }

      // Verify we have a substantial number of endpoints
      // Based on the 10 API groups, we expect at least 50 endpoints
      expect(
        totalEndpoints,
        `Expected at least 50 endpoints, found ${totalEndpoints}`
      ).toBeGreaterThanOrEqual(50)
    })

    it("covers all HTTP methods", () => {
      const spec = OpenApi.fromApi(AppApi)

      const methods = new Set<string>()
      for (const pathItem of Object.values(spec.paths)) {
        for (const method of Object.keys(pathItem)) {
          methods.add(method)
        }
      }

      // Should have GET, POST, PUT, DELETE
      expect(methods.has("get"), "Should have GET endpoints").toBe(true)
      expect(methods.has("post"), "Should have POST endpoints").toBe(true)
      expect(methods.has("put"), "Should have PUT endpoints").toBe(true)
      expect(methods.has("delete"), "Should have DELETE endpoints").toBe(true)
    })
  })
})
