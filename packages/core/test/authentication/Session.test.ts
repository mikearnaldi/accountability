import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, Option } from "effect"
import * as Schema from "effect/Schema"
import { Session, isSession, UserAgent } from "../../src/authentication/Session.ts"
import { SessionId } from "../../src/authentication/SessionId.ts"
import { AuthUserId } from "../../src/authentication/AuthUserId.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

describe("UserAgent", () => {
  describe("validation", () => {
    it.effect("accepts valid user agent strings", () =>
      Effect.gen(function* () {
        const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        const decoded = yield* Schema.decodeUnknown(UserAgent)(ua)
        expect(decoded).toBe(ua)
      })
    )

    it.effect("accepts empty string", () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(UserAgent)("")
        expect(decoded).toBe("")
      })
    )

    it.effect("rejects strings longer than 1024 characters", () =>
      Effect.gen(function* () {
        const longString = "a".repeat(1025)
        const decode = Schema.decodeUnknown(UserAgent)
        const result = yield* Effect.exit(decode(longString))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("accepts strings exactly 1024 characters", () =>
      Effect.gen(function* () {
        const exactString = "a".repeat(1024)
        const decoded = yield* Schema.decodeUnknown(UserAgent)(exactString)
        expect(decoded.length).toBe(1024)
      })
    )
  })
})

describe("Session", () => {
  const validSessionId = "abcdefghijklmnopqrstuvwxyz123456"
  const validUserId = "550e8400-e29b-41d4-a716-446655440000"

  const createValidSession = () =>
    Session.make({
      id: SessionId.make(validSessionId),
      userId: AuthUserId.make(validUserId),
      provider: "local",
      expiresAt: Timestamp.make({ epochMillis: 1718496000000 }), // Future timestamp
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      userAgent: Option.none()
    })

  describe("validation", () => {
    it.effect("accepts valid Session without user agent", () =>
      Effect.gen(function* () {
        const session = createValidSession()
        expect(session.id).toBe(validSessionId)
        expect(session.userId).toBe(validUserId)
        expect(session.provider).toBe("local")
        expect(Option.isNone(session.userAgent)).toBe(true)
      })
    )

    it.effect("accepts valid Session with user agent", () =>
      Effect.gen(function* () {
        const session = Session.make({
          id: SessionId.make(validSessionId),
          userId: AuthUserId.make(validUserId),
          provider: "google",
          expiresAt: Timestamp.make({ epochMillis: 1718496000000 }),
          createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
          userAgent: Option.some("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
        })
        expect(Option.isSome(session.userAgent)).toBe(true)
        if (Option.isSome(session.userAgent)) {
          expect(session.userAgent.value).toContain("Mozilla")
        }
      })
    )

    it.effect("accepts different provider types", () =>
      Effect.gen(function* () {
        const workosSession = Session.make({
          id: SessionId.make(validSessionId),
          userId: AuthUserId.make(validUserId),
          provider: "workos",
          expiresAt: Timestamp.make({ epochMillis: 1718496000000 }),
          createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
          userAgent: Option.none()
        })
        expect(workosSession.provider).toBe("workos")
      })
    )

    it.effect("rejects invalid session ID (too short)", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Session)
        const result = yield* Effect.exit(decode({
          id: "short",
          userId: validUserId,
          provider: "local",
          expiresAt: { epochMillis: 1718496000000 },
          createdAt: { epochMillis: 1718409600000 },
          userAgent: { _tag: "None" }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid provider", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Session)
        const result = yield* Effect.exit(decode({
          id: validSessionId,
          userId: validUserId,
          provider: "invalid",
          expiresAt: { epochMillis: 1718496000000 },
          createdAt: { epochMillis: 1718409600000 },
          userAgent: { _tag: "None" }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isSession returns true for Session instances", () => {
      const session = createValidSession()
      expect(isSession(session)).toBe(true)
    })

    it("isSession returns false for plain objects", () => {
      expect(isSession({
        id: validSessionId,
        userId: validUserId,
        provider: "local"
      })).toBe(false)
    })
  })

  describe("session expiration methods", () => {
    it("isExpired returns false for future expiration", () => {
      const session = Session.make({
        id: SessionId.make(validSessionId),
        userId: AuthUserId.make(validUserId),
        provider: "local",
        expiresAt: Timestamp.make({ epochMillis: 2000000000000 }), // Far future
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        userAgent: Option.none()
      })
      const now = Timestamp.make({ epochMillis: 1718409600000 })
      expect(session.isExpired(now)).toBe(false)
    })

    it("isExpired returns true for past expiration", () => {
      const session = Session.make({
        id: SessionId.make(validSessionId),
        userId: AuthUserId.make(validUserId),
        provider: "local",
        expiresAt: Timestamp.make({ epochMillis: 1718409600000 }),
        createdAt: Timestamp.make({ epochMillis: 1718400000000 }),
        userAgent: Option.none()
      })
      const now = Timestamp.make({ epochMillis: 1718500000000 })
      expect(session.isExpired(now)).toBe(true)
    })

    it("isExpired returns true when now equals expiresAt", () => {
      const session = Session.make({
        id: SessionId.make(validSessionId),
        userId: AuthUserId.make(validUserId),
        provider: "local",
        expiresAt: Timestamp.make({ epochMillis: 1718409600000 }),
        createdAt: Timestamp.make({ epochMillis: 1718400000000 }),
        userAgent: Option.none()
      })
      const now = Timestamp.make({ epochMillis: 1718409600000 })
      expect(session.isExpired(now)).toBe(true)
    })

    it("isValid is inverse of isExpired", () => {
      const session = createValidSession()
      const now = Timestamp.make({ epochMillis: 1718409600000 })
      expect(session.isValid(now)).toBe(!session.isExpired(now))
    })

    it("timeRemainingMs returns positive value for valid session", () => {
      const session = Session.make({
        id: SessionId.make(validSessionId),
        userId: AuthUserId.make(validUserId),
        provider: "local",
        expiresAt: Timestamp.make({ epochMillis: 1718500000000 }),
        createdAt: Timestamp.make({ epochMillis: 1718400000000 }),
        userAgent: Option.none()
      })
      const now = Timestamp.make({ epochMillis: 1718409600000 })
      expect(session.timeRemainingMs(now)).toBe(1718500000000 - 1718409600000)
    })

    it("timeRemainingMs returns 0 for expired session", () => {
      const session = Session.make({
        id: SessionId.make(validSessionId),
        userId: AuthUserId.make(validUserId),
        provider: "local",
        expiresAt: Timestamp.make({ epochMillis: 1718400000000 }),
        createdAt: Timestamp.make({ epochMillis: 1718300000000 }),
        userAgent: Option.none()
      })
      const now = Timestamp.make({ epochMillis: 1718500000000 })
      expect(session.timeRemainingMs(now)).toBe(0)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for Session", () => {
      const session1 = createValidSession()
      const session2 = Session.make({
        id: SessionId.make(validSessionId),
        userId: AuthUserId.make(validUserId),
        provider: "local",
        expiresAt: Timestamp.make({ epochMillis: 1718496000000 }),
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        userAgent: Option.none()
      })
      const session3 = Session.make({
        id: SessionId.make("differentSessionIdThatIsLongEnough"),
        userId: AuthUserId.make(validUserId),
        provider: "google",
        expiresAt: Timestamp.make({ epochMillis: 1718496000000 }),
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        userAgent: Option.none()
      })

      expect(Equal.equals(session1, session2)).toBe(true)
      expect(Equal.equals(session1, session3)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes Session without user agent", () =>
      Effect.gen(function* () {
        const original = createValidSession()
        const encoded = yield* Schema.encode(Session)(original)
        const decoded = yield* Schema.decodeUnknown(Session)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes Session with user agent", () =>
      Effect.gen(function* () {
        const original = Session.make({
          id: SessionId.make(validSessionId),
          userId: AuthUserId.make(validUserId),
          provider: "local",
          expiresAt: Timestamp.make({ epochMillis: 1718496000000 }),
          createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
          userAgent: Option.some("Mozilla/5.0")
        })
        const encoded = yield* Schema.encode(Session)(original)
        const decoded = yield* Schema.decodeUnknown(Session)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const session = createValidSession()
        const encoded = yield* Schema.encode(Session)(session)

        expect(encoded).toHaveProperty("id", validSessionId)
        expect(encoded).toHaveProperty("userId", validUserId)
        expect(encoded).toHaveProperty("provider", "local")
        expect(encoded).toHaveProperty("expiresAt")
        expect(encoded).toHaveProperty("createdAt")
        expect(encoded).toHaveProperty("userAgent")
      })
    )
  })
})
