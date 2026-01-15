import { PgClient } from "@effect/sql-pg"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"

// Production layer using environment variables
export const ProdPgClientLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const url = yield* Config.redacted("DATABASE_URL").pipe(
      Config.orElse(() =>
        Config.all({
          host: Config.string("PGHOST").pipe(Config.withDefault("localhost")),
          port: Config.integer("PGPORT").pipe(Config.withDefault(5432)),
          user: Config.string("PGUSER").pipe(Config.withDefault("postgres")),
          password: Config.redacted("PGPASSWORD").pipe(Config.withDefault(Redacted.make("postgres"))),
          database: Config.string("PGDATABASE").pipe(Config.withDefault("accountability"))
        }).pipe(
          Config.map(({ host, port, user, password, database }) =>
            Redacted.make(
              `postgresql://${user}:${Redacted.value(password)}@${host}:${port}/${database}`
            )
          )
        )
      )
    )

    yield* Effect.log("Connecting to production database")

    return PgClient.layer({
      url,
      maxConnections: 10,
      idleTimeout: "60 seconds",
      connectTimeout: "10 seconds"
    })
  })
)
