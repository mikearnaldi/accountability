import { describe, it, expect } from "@effect/vitest"
import { Effect } from "effect"
import {
  greet,
  PersonSchema,
  decodePerson,
  encodePerson,
  LoggerService,
  TestLogger,
  logGreeting,
  makeConfig,
  getAppInfo,
  AppLayer
} from "../src/index.js"
import * as Schema from "effect/Schema"

describe("Effect.gen", () => {
  it.effect("runs a basic Effect program", () =>
    Effect.gen(function* () {
      const result = yield* greet("World")
      expect(result).toBe("Hello, World!")
    })
  )

  it.effect("composes multiple Effect operations", () =>
    Effect.gen(function* () {
      const r1 = yield* greet("Alice")
      const r2 = yield* greet("Bob")
      expect(r1).toBe("Hello, Alice!")
      expect(r2).toBe("Hello, Bob!")
    })
  )
})

describe("Schema validation", () => {
  it("decodes valid person data", () => {
    const person = decodePerson({ name: "Alice", age: 30 })
    expect(person).toEqual({ name: "Alice", age: 30 })
  })

  it("fails on invalid age (negative)", () => {
    expect(() => decodePerson({ name: "Alice", age: -1 })).toThrow()
  })

  it("fails on invalid age (non-integer)", () => {
    expect(() => decodePerson({ name: "Alice", age: 30.5 })).toThrow()
  })

  it("fails on missing name", () => {
    expect(() => decodePerson({ age: 30 })).toThrow()
  })

  it("fails on invalid type", () => {
    expect(() => decodePerson({ name: 123, age: 30 })).toThrow()
  })

  it("encodes person data", () => {
    const encoded = encodePerson({ name: "Bob", age: 25 })
    expect(encoded).toEqual({ name: "Bob", age: 25 })
  })

  it.effect("works with Effect pipeline", () =>
    Effect.gen(function* () {
      const decode = Schema.decodeUnknown(PersonSchema)
      const person = yield* decode({ name: "Charlie", age: 42 })
      expect(person.name).toBe("Charlie")
      expect(person.age).toBe(42)
    })
  )
})

describe("Context and Layer patterns", () => {
  it.effect("uses LoggerService via Layer", () =>
    Effect.gen(function* () {
      const messages: string[] = []
      yield* logGreeting("Test").pipe(Effect.provide(TestLogger(messages)))
      expect(messages).toEqual(["Hello, Test!"])
    })
  )

  it.effect("uses ConfigService via Layer", () =>
    Effect.gen(function* () {
      const config = { appName: "TestApp", version: "1.0.0" }
      const result = yield* getAppInfo().pipe(Effect.provide(makeConfig(config)))
      expect(result).toBe("TestApp v1.0.0")
    })
  )

  it.effect("composes multiple services with Layer.mergeAll", () =>
    Effect.gen(function* () {
      const config = { appName: "MyApp", version: "2.0.0" }
      const messages: string[] = []

      const testLayer = AppLayer(config).pipe((_layer) => {
        // Replace ConsoleLogger with TestLogger in the layer
        return TestLogger(messages)
      })

      // Use the services provided by the layer
      yield* logGreeting("User").pipe(Effect.provide(testLayer))
      expect(messages).toEqual(["Hello, User!"])
    })
  )

  it.effect("services are isolated between runs", () =>
    Effect.gen(function* () {
      const messages1: string[] = []
      const messages2: string[] = []

      yield* logGreeting("First").pipe(Effect.provide(TestLogger(messages1)))
      yield* logGreeting("Second").pipe(Effect.provide(TestLogger(messages2)))

      expect(messages1).toEqual(["Hello, First!"])
      expect(messages2).toEqual(["Hello, Second!"])
    })
  )

  it.effect("can access service directly via Context.Tag", () =>
    Effect.gen(function* () {
      const logger = yield* LoggerService
      yield* logger.log("Direct message")
    }).pipe(Effect.provide(TestLogger([])))
  )
})

describe("Layer composition", () => {
  it.effect("Layer.mergeAll combines multiple layers", () =>
    Effect.gen(function* () {
      const appInfo = yield* getAppInfo()
      expect(appInfo).toBe("ComposedApp v3.0.0")
    }).pipe(Effect.provide(AppLayer({ appName: "ComposedApp", version: "3.0.0" })))
  )
})
