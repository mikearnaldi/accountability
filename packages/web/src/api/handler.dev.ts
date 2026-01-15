import { PgClient } from "@effect/sql-pg"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as fs from "node:fs"
import * as path from "node:path"

// Error for dev container failures
export class DevContainerError extends Data.TaggedError("DevContainerError")<{
  message: string
  cause?: unknown
}> {}

const DB_DIR = path.resolve(process.cwd(), ".db")

// Development layer using testcontainers with persistent storage
export const DevPgClientLayer = Layer.unwrapScoped(
  Effect.gen(function* () {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }

    yield* Effect.log(`Starting PostgreSQL container with data in ${DB_DIR}`)

    const { PostgreSqlContainer } = yield* Effect.tryPromise({
      try: () => import("@testcontainers/postgresql"),
      catch: (cause) => new DevContainerError({ message: "Failed to load testcontainers", cause })
    })

    const container = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const started = await new PostgreSqlContainer("postgres:16-alpine")
            .withDatabase("accountability_dev")
            .withUsername("dev")
            .withPassword("dev")
            .withBindMounts([{
              source: DB_DIR,
              target: "/var/lib/postgresql/data"
            }])
            .start()
          return started
        },
        catch: (cause) => new DevContainerError({ message: "Failed to start PostgreSQL container", cause })
      }),
      (container) =>
        Effect.gen(function* () {
          yield* Effect.log("Stopping PostgreSQL container...")
          yield* Effect.promise(() => container.stop().catch(() => {}))
          yield* Effect.log("PostgreSQL container stopped")
        })
    )

    yield* Effect.log(`Container started: ${container.getHost()}:${container.getMappedPort(5432)}`)

    const connectionUri = container.getConnectionUri()
    yield* Effect.log(`Connecting to: ${connectionUri.replace(/:[^:@]+@/, ":***@")}`)

    return PgClient.layer({
      url: Redacted.make(connectionUri),
      maxConnections: 5,
      idleTimeout: "60 seconds",
      connectTimeout: "10 seconds"
    })
  })
)
