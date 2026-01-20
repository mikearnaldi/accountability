# Effect HttpApi Best Practices

This document outlines best practices for building APIs with Effect HttpApi to minimize boilerplate and maximize type safety.

## The Problem: Excessive Decoding

A common anti-pattern is using `Schema.String` in API definitions and then manually decoding in handlers:

```typescript
// BAD: Using Schema.String forces manual decoding
const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .setPath(Schema.Struct({ id: Schema.String }))  // Raw string
  .addSuccess(Account)

// Handler must manually decode
.handle("getAccount", (_) =>
  Effect.gen(function* () {
    // Manual decoding - this is a red flag!
    const accountIdResult = Schema.decodeUnknownEither(AccountId)(_.path.id)
    if (accountIdResult._tag === "Left") {
      return yield* Effect.fail(new NotFoundError({ ... }))
    }
    const accountId = accountIdResult.right
    // ...
  })
)
```

This pattern:
- Adds boilerplate to every handler
- Duplicates validation logic
- Makes error handling inconsistent
- Loses type safety at the API boundary

## The Solution: Use Domain Schemas Directly

HttpApi automatically decodes path params, URL params, headers, and payloads using `Schema.decodeUnknown`. Use your domain schemas directly:

```typescript
// GOOD: Use AccountId directly - automatic decoding
const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .setPath(Schema.Struct({ id: AccountId }))  // Branded type
  .addSuccess(Account)

// Handler receives already-decoded AccountId
.handle("getAccount", (_) =>
  Effect.gen(function* () {
    // _.path.id is already AccountId - no manual decoding needed!
    const maybeAccount = yield* accountRepo.findById(_.path.id)
    // ...
  })
)
```

## Schema Design for API Compatibility

### 1. Path Parameters

Path parameters come from URL segments and are always strings. Use branded string schemas:

```typescript
// Domain schema - branded string
export const AccountId = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f-]{36}$/),
  Schema.brand("AccountId")
)

// API endpoint - use domain schema directly
const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .setPath(Schema.Struct({ id: AccountId }))
```

### 2. URL Query Parameters

Query parameters are also strings. Use transforming schemas for non-string types:

```typescript
// GOOD: Use branded types and transforming schemas
export const AccountListParams = Schema.Struct({
  companyId: CompanyId,  // Branded string - works directly
  accountType: Schema.optional(AccountType),  // String literal union - works directly
  isActive: Schema.optional(Schema.BooleanFromString),  // Transform string to boolean
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0)))
})

// BAD: Raw strings requiring manual parsing
export const AccountListParams = Schema.Struct({
  companyId: Schema.String,  // Requires manual CompanyId.decode()
  accountType: Schema.optional(Schema.String),  // Requires manual parsing
  isActive: Schema.optional(Schema.String),  // Requires manual Boolean parsing
})
```

### 3. Request Bodies (Payloads)

Request bodies are JSON, so use your domain schemas directly:

```typescript
// GOOD: Reuse domain schemas
export class CreateAccountRequest extends Schema.Class<CreateAccountRequest>("CreateAccountRequest")({
  companyId: CompanyId,  // Works with JSON
  accountType: AccountType,  // Works with JSON
  parentAccountId: Schema.OptionFromNullOr(AccountId),  // Option encoded as null
  // ...
}) {}
```

### 4. Response Bodies

Return domain entities directly when possible:

```typescript
// GOOD: Return domain entity
const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .addSuccess(Account)  // Domain entity as response

// GOOD: Wrapper for lists with metadata
export class AccountListResponse extends Schema.Class<AccountListResponse>("AccountListResponse")({
  accounts: Schema.Array(Account),  // Reuse domain entity
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number
}) {}
```

## Schema Encoding Considerations

### OptionFromNullOr for Optional Fields

Use `Schema.OptionFromNullOr` for optional fields in JSON payloads:

```typescript
// JSON: { "parentAccountId": null } or { "parentAccountId": "abc-123" }
// Domain: Option.none() or Option.some(AccountId)
parentAccountId: Schema.OptionFromNullOr(AccountId)
```

### DateTimeUtc for Timestamps

Use `Schema.DateTimeUtc` for ISO timestamp strings:

```typescript
// JSON: "2024-01-15T10:30:00Z"
// Domain: DateTime.Utc
createdAt: Schema.DateTimeUtc
```

### BigDecimalFromString for Monetary Values

Use transforming schemas for BigDecimal:

```typescript
// JSON: "1234.56"
// Domain: BigDecimal
amount: Schema.BigDecimalFromString
```

## Error Handling

### Use HttpApiSchema.annotations for Status Codes

Annotate error schemas with HTTP status codes:

```typescript
export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  { resource: Schema.String, id: Schema.String }
) {}

// In endpoint definition
const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .addError(NotFoundError, { status: 404 })
```

### Let HttpApi Handle Parse Errors

Don't catch parse errors manually - HttpApi converts them to 400 Bad Request automatically:

```typescript
// BAD: Manual parse error handling
.handle("getAccount", (_) =>
  Effect.gen(function* () {
    const result = Schema.decodeUnknownEither(AccountId)(_.path.id)
    if (result._tag === "Left") {
      return yield* Effect.fail(new ValidationError({ ... }))
    }
    // ...
  })
)

// GOOD: Use AccountId in schema, let HttpApi handle invalid input
.setPath(Schema.Struct({ id: AccountId }))  // Invalid UUIDs become 400 automatically
```

## Summary: API Definition Checklist

1. **Path params**: Use branded string schemas (`AccountId`, `CompanyId`)
2. **Query params**: Use branded strings + transforming schemas (`BooleanFromString`, `NumberFromString`)
3. **Request body**: Use domain schemas with `OptionFromNullOr` for optional fields
4. **Response body**: Return domain entities directly or wrap in response classes
5. **Errors**: Annotate with HTTP status codes, don't manually handle parse errors
6. **No manual decoding**: If you're calling `Schema.decode*` in a handler, reconsider your API schema

## Example: Well-Designed API

```typescript
// AccountsApi.ts - Clean API definition
const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .setPath(Schema.Struct({ id: AccountId }))
  .addSuccess(Account)
  .addError(NotFoundError, { status: 404 })

const listAccounts = HttpApiEndpoint.get("listAccounts", "/")
  .setUrlParams(Schema.Struct({
    companyId: CompanyId,
    accountType: Schema.optional(AccountType),
    isActive: Schema.optional(Schema.BooleanFromString),
    limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.positive())),
    offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.nonNegative()))
  }))
  .addSuccess(AccountListResponse)
  .addError(NotFoundError, { status: 404 })

// AccountsApiLive.ts - Clean handler
export const AccountsApiLive = HttpApiBuilder.group(AppApi, "accounts", (handlers) =>
  Effect.gen(function* () {
    const accountRepo = yield* AccountRepository

    return handlers
      .handle("getAccount", (_) =>
        Effect.gen(function* () {
          // _.path.id is already AccountId - no decoding needed!
          const maybeAccount = yield* accountRepo.findById(_.path.id)
          return yield* Option.match(maybeAccount, {
            onNone: () => Effect.fail(new NotFoundError({ resource: "Account", id: _.path.id })),
            onSome: Effect.succeed
          })
        })
      )
      .handle("listAccounts", (_) =>
        Effect.gen(function* () {
          // _.urlParams.companyId is already CompanyId
          // _.urlParams.accountType is already Option<AccountType>
          // _.urlParams.isActive is already Option<boolean>
          const accounts = yield* accountRepo.findByCompany(_.urlParams.companyId)
          // Filter using already-decoded values...
        })
      )
  })
)
```
