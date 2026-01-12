/**
 * Demo Atoms - Example atoms demonstrating Effect Atom patterns
 *
 * This module contains demonstration atoms showing the three main patterns:
 * 1. Simple state - Basic writable atoms for local state
 * 2. Computed/derived state - Read-only atoms derived from other atoms
 * 3. Async state - Atoms that fetch data from APIs
 *
 * These patterns replace TanStack Query patterns with Effect Atom.
 *
 * @module demo
 */

import * as Atom from "@effect-atom/atom/Atom"
import * as Duration from "effect/Duration"
import type { AccountId } from "@accountability/core/domain/Account"
import { ApiClient } from "./ApiClient.ts"

// =============================================================================
// Pattern 1: Simple State (writable atoms)
// =============================================================================

/**
 * Counter atom - Simple numeric state
 *
 * This is the most basic atom pattern - a writable value that can be
 * read and updated from React components.
 *
 * Usage in React:
 * ```typescript
 * const [count, setCount] = useAtom(counterAtom)
 * setCount(c => c + 1) // increment
 * setCount(0)          // reset
 * ```
 */
export const counterAtom = Atom.make(0)

/**
 * Selected company ID atom - Optional string state
 *
 * Demonstrates nullable/optional state. Used to track which company
 * is currently selected in the UI.
 *
 * Usage:
 * ```typescript
 * const [selectedId, setSelectedId] = useAtom(selectedCompanyIdAtom)
 * setSelectedId("comp_123") // select
 * setSelectedId(null)       // deselect
 * ```
 */
export const selectedCompanyIdAtom = Atom.make<string | null>(null)

/**
 * Search query atom - String state with typical search pattern
 *
 * Used for search inputs where we want to track the query string.
 */
export const searchQueryAtom = Atom.make("")

// =============================================================================
// Pattern 2: Computed/Derived State (read-only atoms)
// =============================================================================

/**
 * Double counter atom - Derived from counterAtom
 *
 * This atom automatically recomputes whenever counterAtom changes.
 * It's read-only - you cannot set its value directly.
 *
 * Usage:
 * ```typescript
 * const double = useAtomValue(doubleCounterAtom)
 * // double automatically updates when counterAtom changes
 * ```
 */
export const doubleCounterAtom = Atom.readable((get) => get(counterAtom) * 2)

/**
 * Has selection atom - Boolean derived from selectedCompanyIdAtom
 *
 * Demonstrates deriving boolean state from nullable state.
 */
export const hasSelectionAtom = Atom.readable((get) => get(selectedCompanyIdAtom) !== null)

/**
 * Formatted search atom - Derived with transformation
 *
 * Demonstrates transforming string state (trimming, lowercasing).
 */
export const formattedSearchAtom = Atom.readable((get) =>
  get(searchQueryAtom).trim().toLowerCase()
)

/**
 * Is search valid atom - Derived boolean for search validation
 *
 * Only valid if search query has at least 2 characters after trimming.
 */
export const isSearchValidAtom = Atom.readable((get) =>
  get(formattedSearchAtom).length >= 2
)

// =============================================================================
// Pattern 3: Async State (atoms with Effect)
// =============================================================================

/**
 * Health check atom - Async query with caching
 *
 * This atom fetches the health check endpoint and returns a Result type.
 * The timeToLive option caches the result for 1 minute.
 *
 * Usage:
 * ```typescript
 * const result = useAtomValue(healthCheckAtom)
 *
 * Result.match(result, {
 *   onInitial: () => <Loading />,
 *   onWaiting: (prev) => <Loading previous={prev} />,
 *   onSuccess: ({ value }) => <Status status={value.status} />,
 *   onFailure: ({ cause }) => <Error cause={cause} />
 * })
 * ```
 */
export const healthCheckAtom = ApiClient.query("health", "healthCheck", {
  timeToLive: Duration.minutes(1)
})

// =============================================================================
// Atom Families (parameterized atoms)
// =============================================================================

/**
 * Account by ID atom family - Parameterized async atom
 *
 * Creates a memoized atom for each account ID. Multiple calls with the
 * same ID return the same atom instance.
 *
 * Usage:
 * ```typescript
 * const accountAtom = accountByIdFamily(AccountId.make("acc_123"))
 * const result = useAtomValue(accountAtom)
 * ```
 */
export const accountByIdFamily = Atom.family((id: typeof AccountId.Type) =>
  ApiClient.query("accounts", "getAccount", {
    path: { id },
    timeToLive: Duration.minutes(5)
  })
)

// =============================================================================
// Mutations
// =============================================================================

/**
 * Create account mutation - Type-safe mutation for creating accounts
 *
 * Returns an atom that can be called to execute the mutation.
 *
 * Usage:
 * ```typescript
 * const [result, createAccount] = useAtom(createAccountMutation)
 *
 * // Call the mutation
 * createAccount({
 *   payload: {
 *     name: "Cash",
 *     code: "1000",
 *     type: "Asset",
 *     // ... other fields
 *   }
 * })
 *
 * // Result contains the mutation state
 * if (Result.isSuccess(result)) {
 *   console.log("Created:", result.value)
 * }
 * ```
 */
export const createAccountMutation = ApiClient.mutation("accounts", "createAccount")

/**
 * Create company mutation - Type-safe mutation for creating companies
 */
export const createCompanyMutation = ApiClient.mutation("companies", "createCompany")
