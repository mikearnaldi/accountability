import { Context, Effect, Layer } from "effect"
import * as Schema from "effect/Schema"

// =============================================================================
// Value Objects - Re-exports
// =============================================================================

export * as CurrencyCode from "./CurrencyCode.js"
export * as AccountNumber from "./AccountNumber.js"
export * as MonetaryAmount from "./MonetaryAmount.js"
export * as JurisdictionCode from "./JurisdictionCode.js"
export * as Percentage from "./Percentage.js"
export * as LocalDate from "./LocalDate.js"
export * as Timestamp from "./Timestamp.js"
export * as FiscalPeriodRef from "./FiscalPeriodRef.js"

// =============================================================================
// Basic Effect Program with Effect.gen
// =============================================================================

export const greet = (name: string): Effect.Effect<string> =>
  Effect.gen(function* () {
    const greeting = `Hello, ${name}!`
    return greeting
  })

// =============================================================================
// Schema Validation
// =============================================================================

export const PersonSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number.pipe(Schema.int(), Schema.positive())
})

export type Person = typeof PersonSchema.Type
export type PersonInput = typeof PersonSchema.Encoded

export const decodePerson = Schema.decodeUnknownSync(PersonSchema)
export const encodePerson = Schema.encodeSync(PersonSchema)

// =============================================================================
// Context and Layer Patterns for Dependency Injection
// =============================================================================

export interface Logger {
  readonly log: (message: string) => Effect.Effect<void>
}

export class LoggerService extends Context.Tag("LoggerService")<LoggerService, Logger>() {}

export const ConsoleLogger = Layer.succeed(LoggerService, {
  // eslint-disable-next-line no-console
  log: (message: string) => Effect.sync(() => console.log(message))
})

export const TestLogger = (messages: string[]) =>
  Layer.succeed(LoggerService, {
    log: (message: string) =>
      Effect.sync(() => {
        messages.push(message)
      })
  })

export const logGreeting = (name: string): Effect.Effect<void, never, LoggerService> =>
  Effect.gen(function* () {
    const logger = yield* LoggerService
    const message = yield* greet(name)
    yield* logger.log(message)
  })

// =============================================================================
// More Complex Service Example
// =============================================================================

export interface Config {
  readonly appName: string
  readonly version: string
}

export class ConfigService extends Context.Tag("ConfigService")<ConfigService, Config>() {}

export const makeConfig = (config: Config): Layer.Layer<ConfigService> =>
  Layer.succeed(ConfigService, config)

export const getAppInfo = (): Effect.Effect<string, never, ConfigService> =>
  Effect.gen(function* () {
    const config = yield* ConfigService
    return `${config.appName} v${config.version}`
  })

// Combined Layer example
export const AppLayer = (config: Config) => Layer.mergeAll(ConsoleLogger, makeConfig(config))
