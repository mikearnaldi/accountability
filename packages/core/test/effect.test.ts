import { describe, it, expect } from "@effect/vitest"
import { Context, Effect, Layer } from "effect"
import * as Schema from "effect/Schema"

// Test basic Effect patterns that are used throughout the codebase

describe("Effect.gen", () => {
  it.effect("runs a basic Effect program", () =>
    Effect.gen(function* () {
      const greeting = yield* Effect.succeed("Hello, World!")
      expect(greeting).toBe("Hello, World!")
    })
  )

  it.effect("composes multiple Effect operations", () =>
    Effect.gen(function* () {
      const r1 = yield* Effect.succeed("Hello, Alice!")
      const r2 = yield* Effect.succeed("Hello, Bob!")
      expect(r1).toBe("Hello, Alice!")
      expect(r2).toBe("Hello, Bob!")
    })
  )
})

describe("Schema validation", () => {
  const PersonSchema = Schema.Struct({
    name: Schema.String,
    age: Schema.Number.pipe(Schema.int(), Schema.positive())
  })

  it.effect("decodes valid person data", () =>
    Effect.gen(function* () {
      const person = yield* Schema.decodeUnknown(PersonSchema)({ name: "Alice", age: 30 })
      expect(person).toEqual({ name: "Alice", age: 30 })
    })
  )

  it.effect("fails on invalid age (negative)", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(Schema.decodeUnknown(PersonSchema)({ name: "Alice", age: -1 }))
      expect(result._tag).toBe("Failure")
    })
  )

  it.effect("fails on invalid age (non-integer)", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(Schema.decodeUnknown(PersonSchema)({ name: "Alice", age: 30.5 }))
      expect(result._tag).toBe("Failure")
    })
  )

  it.effect("fails on missing name", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(Schema.decodeUnknown(PersonSchema)({ age: 30 }))
      expect(result._tag).toBe("Failure")
    })
  )

  it.effect("fails on invalid type", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(Schema.decodeUnknown(PersonSchema)({ name: 123, age: 30 }))
      expect(result._tag).toBe("Failure")
    })
  )

  it.effect("encodes person data", () =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encode(PersonSchema)({ name: "Bob", age: 25 })
      expect(encoded).toEqual({ name: "Bob", age: 25 })
    })
  )

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
  interface Logger {
    readonly log: (message: string) => Effect.Effect<void>
  }

  class LoggerService extends Context.Tag("LoggerService")<LoggerService, Logger>() {}

  const TestLogger = (messages: string[]) =>
    Layer.succeed(LoggerService, {
      log: (message: string) =>
        Effect.sync(() => {
          messages.push(message)
        })
    })

  const greet = (name: string): Effect.Effect<string> =>
    Effect.succeed(`Hello, ${name}!`)

  const logGreeting = (name: string): Effect.Effect<void, never, LoggerService> =>
    Effect.gen(function* () {
      const logger = yield* LoggerService
      const message = yield* greet(name)
      yield* logger.log(message)
    })

  it.effect("uses LoggerService via Layer", () =>
    Effect.gen(function* () {
      const messages: string[] = []
      yield* logGreeting("Test").pipe(Effect.provide(TestLogger(messages)))
      expect(messages).toEqual(["Hello, Test!"])
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
  interface Config {
    readonly appName: string
    readonly version: string
  }

  class ConfigService extends Context.Tag("ConfigService")<ConfigService, Config>() {}

  const makeConfig = (config: Config): Layer.Layer<ConfigService> =>
    Layer.succeed(ConfigService, config)

  const getAppInfo = (): Effect.Effect<string, never, ConfigService> =>
    Effect.gen(function* () {
      const config = yield* ConfigService
      return `${config.appName} v${config.version}`
    })

  it.effect("Layer.succeed provides configuration", () =>
    Effect.gen(function* () {
      const appInfo = yield* getAppInfo()
      expect(appInfo).toBe("ComposedApp v3.0.0")
    }).pipe(Effect.provide(makeConfig({ appName: "ComposedApp", version: "3.0.0" })))
  )

  it.effect("uses ConfigService via Layer", () =>
    Effect.gen(function* () {
      const config = { appName: "TestApp", version: "1.0.0" }
      const result = yield* getAppInfo().pipe(Effect.provide(makeConfig(config)))
      expect(result).toBe("TestApp v1.0.0")
    })
  )
})
