import { PgClient } from "@effect/sql-pg"
import { expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { PgContainer } from "./Utils.ts"

it.layer(PgContainer.ClientLive, { timeout: "30 seconds" })("PgContainer", (it) => {
  it.effect("creates table, inserts row, and queries it back", () =>
    Effect.gen(function*() {
      const sql = yield* PgClient.PgClient

      // Create table
      yield* sql`CREATE TABLE test_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        balance NUMERIC(15,2) NOT NULL DEFAULT 0
      )`

      // Insert row
      yield* sql`INSERT INTO test_accounts (id, name, balance) VALUES ('acc_1', 'Cash', 1000.50)`

      // Query it back
      const rows = yield* sql<{
        id: string
        name: string
        balance: string
      }>`SELECT * FROM test_accounts WHERE id = 'acc_1'`

      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe("acc_1")
      expect(rows[0].name).toBe("Cash")
      expect(rows[0].balance).toBe("1000.50")
    })
  )

  it.effect("handles multiple inserts and queries", () =>
    Effect.gen(function*() {
      const sql = yield* PgClient.PgClient

      // Create a separate table for this test
      yield* sql`CREATE TABLE test_items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      )`

      // Insert multiple rows
      yield* sql`INSERT INTO test_items (name) VALUES ('Item 1')`
      yield* sql`INSERT INTO test_items (name) VALUES ('Item 2')`
      yield* sql`INSERT INTO test_items (name) VALUES ('Item 3')`

      // Query all
      const rows = yield* sql<{ id: number; name: string }>`SELECT * FROM test_items ORDER BY id`

      expect(rows).toHaveLength(3)
      expect(rows[0].name).toBe("Item 1")
      expect(rows[1].name).toBe("Item 2")
      expect(rows[2].name).toBe("Item 3")
    })
  )

  it.effect("supports transactions", () =>
    Effect.gen(function*() {
      const sql = yield* PgClient.PgClient

      // Create table
      yield* sql`CREATE TABLE test_ledger (
        id TEXT PRIMARY KEY,
        amount NUMERIC(15,2) NOT NULL
      )`

      // Transaction that commits
      yield* sql.withTransaction(
        Effect.gen(function*() {
          yield* sql`INSERT INTO test_ledger (id, amount) VALUES ('entry_1', 100.00)`
          yield* sql`INSERT INTO test_ledger (id, amount) VALUES ('entry_2', 200.00)`
        })
      )

      // Verify committed
      const rows = yield* sql<{ id: string; amount: string }>`SELECT * FROM test_ledger ORDER BY id`
      expect(rows).toHaveLength(2)
      expect(rows[0].amount).toBe("100.00")
      expect(rows[1].amount).toBe("200.00")
    })
  )
})
