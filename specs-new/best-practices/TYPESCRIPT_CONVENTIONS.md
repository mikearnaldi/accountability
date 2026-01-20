# TypeScript Conventions

This document describes TypeScript configuration and module conventions for this project.

## TypeScript Project References

This monorepo uses TypeScript project references for incremental builds. Each package follows this pattern:

- **tsconfig.json** - Root config with `references` to src and test configs
- **tsconfig.src.json** - Source compilation config (must have `composite: true`)
- **tsconfig.test.json** - Test compilation config

**IMPORTANT: All tsconfig.src.json files must have `composite: true`** for project references to work correctly. This enables incremental builds and proper dependency tracking between packages.

```json
// tsconfig.src.json - MUST have composite: true
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": {
    "composite": true,
    "outDir": "dist",
    "rootDir": "src",
    "tsBuildInfoFile": ".tsbuildinfo/src.tsbuildinfo"
  },
  "references": [
    { "path": "../core/tsconfig.src.json" }
  ]
}
```

## Module Resolution and Imports

This project uses `moduleResolution: "bundler"` with direct `.ts` imports. TypeScript rewrites `.ts` to `.js` in emitted files:

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "rewriteRelativeImportExtensions": true,
    "verbatimModuleSyntax": true
  }
}
```

The `rewriteRelativeImportExtensions` option (TypeScript 5.7+) automatically rewrites `.ts` imports to `.js` in the compiled output, so you write `.ts` in source but get valid `.js` imports in dist.

### Relative Imports: Always Use `.ts` Extension

```typescript
// CORRECT - relative imports use .ts extension
import { Account } from "./domain/Account.ts"
import { MonetaryAmount } from "./domain/MonetaryAmount.ts"
import { AccountService } from "./services/AccountService.ts"

// WRONG - don't use .js extension for relative imports
import { Account } from "./domain/Account.js"
```

### Package Imports: Never Use Extensions

```typescript
// CORRECT - package imports are extensionless
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import { PgClient } from "@effect/sql-pg"

// WRONG - don't use extensions for package imports
import * as Effect from "effect/Effect.js"
import * as Schema from "effect/Schema.ts"
```

Package resolution relies on properly configured `package.json` exports - no extensions needed.

### NEVER Include `/src/` in Package Imports

```typescript
// CORRECT - no /src/ in path
import { CompanyRepository } from "@accountability/persistence/CompanyRepository"
import { Account } from "@accountability/core/Account"

// WRONG - NEVER include /src/ in imports
import { CompanyRepository } from "@accountability/persistence/src/CompanyRepository"
import { CompanyRepository } from "@accountability/persistence/src/CompanyRepository.ts"
```

The `package.json` exports field maps the public API - `/src/` is an implementation detail that should never appear in imports.

## NEVER Use index.ts Barrel Files

**This is a strict rule: NEVER create index.ts files.** Barrel files cause:
- Circular dependency issues
- Slower build times (importing everything when you need one thing)
- Harder to trace imports
- Bundle size bloat

```typescript
// CORRECT - import from specific module
import { Account, AccountId } from "./domain/Account.ts"
import { MonetaryAmount } from "./domain/MonetaryAmount.ts"

// WRONG - NEVER do this
import { Account, MonetaryAmount } from "./domain/index.ts"

// WRONG - NEVER create files like this
// index.ts
export * from "./Account.ts"
export * from "./MonetaryAmount.ts"
```

If you see an index.ts file, delete it and update imports to point to specific modules.

## Module Structure - Flat Modules, No Barrel Files

**Avoid barrel files** (index.ts re-exports). Create flat, focused modules:

```
packages/core/src/
├── CurrencyCode.ts      # NOT domain/currency/CurrencyCode.ts + index.ts
├── AccountId.ts
├── Account.ts
├── AccountError.ts
├── AccountService.ts
└── Money.ts
```

**Each module should be self-contained:**

```typescript
// CurrencyCode.ts - everything related to CurrencyCode in one file
import * as Schema from "effect/Schema"

export class CurrencyCode extends Schema.Class<CurrencyCode>("CurrencyCode")({
  code: Schema.String.pipe(Schema.length(3)),
  name: Schema.String,
  symbol: Schema.String,
  decimalPlaces: Schema.Number
}) {}

export const isoCurrencies = {
  USD: CurrencyCode.make({ code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 }),
  EUR: CurrencyCode.make({ code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 }),
  // ...
}
```
