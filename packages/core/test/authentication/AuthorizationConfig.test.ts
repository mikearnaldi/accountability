/**
 * AuthorizationConfig Tests
 *
 * Tests for the AuthorizationConfig module that controls authorization
 * enforcement mode (strict vs grace period).
 */

import * as Effect from "effect/Effect"
import { describe, expect, it } from "@effect/vitest"
import {
  AuthorizationConfig,
  AuthorizationConfigEnforced,
  AuthorizationConfigGracePeriod,
  makeAuthorizationConfigLayer,
  authorizationConfigDefaults
} from "../../src/authorization/AuthorizationConfig.ts"

describe("AuthorizationConfig", () => {
  describe("defaults", () => {
    it("should default to enforcement enabled", () => {
      expect(authorizationConfigDefaults.enforcementEnabled).toBe(true)
    })
  })

  describe("makeAuthorizationConfigLayer", () => {
    it.effect("should create layer with specified config", () =>
      Effect.gen(function* () {
        const config = yield* AuthorizationConfig

        expect(config.enforcementEnabled).toBe(false)
      }).pipe(
        Effect.provide(makeAuthorizationConfigLayer({ enforcementEnabled: false }))
      )
    )

    it.effect("should create layer with enforcement enabled", () =>
      Effect.gen(function* () {
        const config = yield* AuthorizationConfig

        expect(config.enforcementEnabled).toBe(true)
      }).pipe(
        Effect.provide(makeAuthorizationConfigLayer({ enforcementEnabled: true }))
      )
    )
  })

  describe("preset layers", () => {
    it.effect("AuthorizationConfigEnforced should have enforcement enabled", () =>
      Effect.gen(function* () {
        const config = yield* AuthorizationConfig

        expect(config.enforcementEnabled).toBe(true)
      }).pipe(Effect.provide(AuthorizationConfigEnforced))
    )

    it.effect("AuthorizationConfigGracePeriod should have enforcement disabled", () =>
      Effect.gen(function* () {
        const config = yield* AuthorizationConfig

        expect(config.enforcementEnabled).toBe(false)
      }).pipe(Effect.provide(AuthorizationConfigGracePeriod))
    )
  })

  describe("Context.Tag behavior", () => {
    it("should have correct tag name", () => {
      expect(AuthorizationConfig.key).toBe("AuthorizationConfig")
    })

    it.effect("should be accessible via AuthorizationConfig tag", () =>
      Effect.gen(function* () {
        const config = yield* AuthorizationConfig

        expect(config).toBeDefined()
        expect(typeof config.enforcementEnabled).toBe("boolean")
      }).pipe(Effect.provide(AuthorizationConfigEnforced))
    )
  })
})
