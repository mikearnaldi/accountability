import js from "@eslint/js"
import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import prettierConfig from "eslint-config-prettier"

/**
 * Custom ESLint rule to enforce import extension conventions:
 * - Relative imports (./foo or ../foo) must use .ts or .tsx extension
 * - Package imports (effect/Schema, @effect/sql) must be extensionless
 */
const importExtensionsRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce .ts/.tsx extension for relative imports and no extension for package imports"
    },
    messages: {
      relativeRequiresTs: "Relative imports must use .ts or .tsx extension. Change '{{source}}' to '{{source}}.ts'",
      relativeNoJs: "Relative imports must use .ts or .tsx extension, not .js/.jsx. Change '{{source}}' to '{{fixed}}'",
      packageNoExtension: "Package imports must not have an extension. Change '{{source}}' to '{{fixed}}'"
    },
    schema: []
  },
  create(context) {
    function checkImportSource(node, source) {
      if (!source || typeof source !== "string") return

      const isRelative = source.startsWith("./") || source.startsWith("../")

      if (isRelative) {
        // Allow Vite special import suffixes like ?url, ?raw, ?worker, etc.
        // These are used for special asset handling and don't follow normal extension rules
        if (source.includes("?")) {
          return
        }

        // Relative imports must use .ts or .tsx
        if (source.endsWith(".js") || source.endsWith(".jsx")) {
          const fixed = source.replace(/\.jsx?$/, ".ts")
          context.report({
            node,
            messageId: "relativeNoJs",
            data: { source, fixed }
          })
        } else if (!source.endsWith(".ts") && !source.endsWith(".tsx") && !source.endsWith(".json")) {
          // Missing extension on relative import
          context.report({
            node,
            messageId: "relativeRequiresTs",
            data: { source }
          })
        }
      } else {
        // Package imports must be extensionless
        if (source.endsWith(".ts") || source.endsWith(".tsx") || source.endsWith(".js") || source.endsWith(".jsx")) {
          const fixed = source.replace(/\.(tsx?|jsx?)$/, "")
          context.report({
            node,
            messageId: "packageNoExtension",
            data: { source, fixed }
          })
        }
      }
    }

    return {
      ImportDeclaration(node) {
        checkImportSource(node, node.source?.value)
      },
      ImportExpression(node) {
        if (node.source?.type === "Literal") {
          checkImportSource(node, node.source.value)
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          checkImportSource(node, node.source.value)
        }
      },
      ExportAllDeclaration(node) {
        checkImportSource(node, node.source?.value)
      }
    }
  }
}

/**
 * Custom ESLint rule to ban { disableValidation: true } in Schema.make() calls.
 * Disabling validation defeats the purpose of using Schema and can hide bugs.
 */
const noDisableValidationRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow disableValidation: true in Schema operations"
    },
    messages: {
      noDisableValidation: "Do not use { disableValidation: true }. Schema validation should always be enabled to catch invalid data. If you're seeing validation errors, fix the data or schema instead of disabling validation."
    },
    schema: []
  },
  create(context) {
    return {
      Property(node) {
        if (
          node.key &&
          ((node.key.type === "Identifier" && node.key.name === "disableValidation") ||
           (node.key.type === "Literal" && node.key.value === "disableValidation")) &&
          node.value &&
          node.value.type === "Literal" &&
          node.value.value === true
        ) {
          context.report({
            node,
            messageId: "noDisableValidation"
          })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban sql<Type>`...` pattern.
 * Using type parameters with sql template literals provides no runtime validation.
 * Use SqlSchema.findOne/findAll/single/void with Schema for type-safe queries.
 */
const noSqlTypeParameterRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow type parameters on sql template literals"
    },
    messages: {
      noSqlTypeParam: "Do not use sql<Type>`...`. Type parameters provide no runtime validation. Use SqlSchema.findOne/findAll/single/void with a Schema for type-safe queries that validate at runtime."
    },
    schema: []
  },
  create(context) {
    return {
      TaggedTemplateExpression(node) {
        const tag = node.tag
        // Check for sql<Type>`...` - typeArguments on TaggedTemplateExpression
        if (node.typeArguments || node.typeParameters) {
          // Check if tag is sql or ends with .sql
          const isSql =
            (tag.type === "Identifier" && tag.name === "sql") ||
            (tag.type === "MemberExpression" &&
              tag.property.type === "Identifier" &&
              tag.property.name === "sql")
          if (isSql) {
            context.report({
              node,
              messageId: "noSqlTypeParam"
            })
          }
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to suggest Option.fromNullable instead of ternary with Option.some/none.
 * x !== null ? Option.some(x) : Option.none() should be Option.fromNullable(x)
 */
const preferOptionFromNullableRule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer Option.fromNullable over ternary with Option.some/none"
    },
    messages: {
      preferFromNullable: "Use Option.fromNullable({{name}}) instead of ternary with Option.some/Option.none."
    },
    schema: []
  },
  create(context) {
    return {
      ConditionalExpression(node) {
        const { test, consequent, alternate } = node

        // Check if test is: x !== null or x != null
        if (test.type !== "BinaryExpression") return
        if (test.operator !== "!==" && test.operator !== "!=") return

        let testedName = null
        if (test.left.type === "Identifier" && test.right.type === "Literal" && test.right.value === null) {
          testedName = test.left.name
        } else if (test.right.type === "Identifier" && test.left.type === "Literal" && test.left.value === null) {
          testedName = test.right.name
        } else if (test.left.type === "MemberExpression" && test.right.type === "Literal" && test.right.value === null) {
          testedName = context.getSourceCode().getText(test.left)
        } else if (test.right.type === "MemberExpression" && test.left.type === "Literal" && test.left.value === null) {
          testedName = context.getSourceCode().getText(test.right)
        }
        if (!testedName) return

        // Check if consequent is Option.some(x)
        if (consequent.type !== "CallExpression") return
        const conseqCallee = consequent.callee
        const isOptionSome =
          conseqCallee.type === "MemberExpression" &&
          conseqCallee.object.type === "Identifier" &&
          conseqCallee.object.name === "Option" &&
          conseqCallee.property.type === "Identifier" &&
          conseqCallee.property.name === "some"
        if (!isOptionSome) return

        // Check if alternate is Option.none()
        if (alternate.type !== "CallExpression") return
        const altCallee = alternate.callee
        // Handle both Option.none() and Option.none<Type>()
        const isOptionNone =
          (altCallee.type === "MemberExpression" &&
           altCallee.object.type === "Identifier" &&
           altCallee.object.name === "Option" &&
           altCallee.property.type === "Identifier" &&
           altCallee.property.name === "none") ||
          (altCallee.type === "TSInstantiationExpression" &&
           altCallee.expression.type === "MemberExpression" &&
           altCallee.expression.object.type === "Identifier" &&
           altCallee.expression.object.name === "Option" &&
           altCallee.expression.property.type === "Identifier" &&
           altCallee.expression.property.name === "none")
        if (!isOptionNone) return

        context.report({
          node,
          messageId: "preferFromNullable",
          data: { name: testedName }
        })
      }
    }
  }
}

/**
 * Custom ESLint rule to ban all localStorage usage.
 * localStorage is vulnerable to XSS attacks and should never be used.
 * Use httpOnly cookies for auth, and React state/context for app state.
 */
const noLocalStorageRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow all localStorage usage"
    },
    messages: {
      noLocalStorage: "Do not use localStorage. It is vulnerable to XSS attacks. Use httpOnly cookies for auth tokens, or React state/context for app state."
    },
    schema: []
  },
  create(context) {
    return {
      // Catch any reference to localStorage identifier
      Identifier(node) {
        if (node.name === "localStorage") {
          // Make sure it's not a property name (e.g., obj.localStorage is ok if obj isn't window)
          if (node.parent.type === "MemberExpression" && node.parent.property === node) {
            // This is a property access like something.localStorage
            // Only report if the object is window or globalThis
            const obj = node.parent.object
            if (obj.type === "Identifier" && (obj.name === "window" || obj.name === "globalThis")) {
              context.report({ node: node.parent, messageId: "noLocalStorage" })
            }
            return
          }
          // Direct reference to localStorage
          context.report({ node, messageId: "noLocalStorage" })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban direct fetch() usage.
 * Use the openapi-fetch client (api.GET, api.POST, etc.) instead.
 * Direct fetch bypasses type safety, authentication handling, and error handling.
 */
const noDirectFetchRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow direct fetch() usage - use openapi-fetch client instead"
    },
    messages: {
      noDirectFetch: "Do not use fetch() directly. Use the openapi-fetch client (api.GET, api.POST, etc.) instead. This provides type safety and automatic cookie handling."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee

        // Direct fetch() call
        if (callee.type === "Identifier" && callee.name === "fetch") {
          context.report({ node, messageId: "noDirectFetch" })
          return
        }

        // window.fetch() or globalThis.fetch()
        if (callee.type === "MemberExpression" &&
            callee.property.type === "Identifier" &&
            callee.property.name === "fetch" &&
            callee.object.type === "Identifier" &&
            (callee.object.name === "window" || callee.object.name === "globalThis")) {
          context.report({ node, messageId: "noDirectFetch" })
          return
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to warn when .pipe() has too many arguments.
 * Long pipes are hard to read and should be split into multiple .pipe() calls.
 */
const pipeMaxArgumentsRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow .pipe() with more than 20 arguments"
    },
    messages: {
      tooManyArgs: ".pipe() has {{count}} arguments. Consider splitting into multiple .pipe() calls for readability (max 20)."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        // Check for .pipe() method call
        if (
          callee.type === "MemberExpression" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "pipe"
        ) {
          if (node.arguments.length > 20) {
            context.report({
              node,
              messageId: "tooManyArgs",
              data: { count: node.arguments.length }
            })
          }
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban Effect.asVoid usage.
 * Effect.asVoid is usually unnecessary because `void` allows any value to be returned.
 * The return type Effect<void, E, R> already accepts any success value.
 */
const noEffectAsVoidRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Effect.asVoid - it is usually unnecessary"
    },
    messages: {
      noEffectAsVoid: "Effect.asVoid is usually unnecessary. The `void` return type already allows any value to be returned from an effect. Remove it."
    },
    schema: []
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object.type === "Identifier" &&
          node.object.name === "Effect" &&
          node.property.type === "Identifier" &&
          node.property.name === "asVoid"
        ) {
          context.report({
            node,
            messageId: "noEffectAsVoid"
          })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban Effect.ignore usage.
 * Effect.ignore silently discards errors which hides bugs.
 * Errors should be explicitly handled or propagated.
 */
const noEffectIgnoreRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Effect.ignore - errors should be explicitly handled"
    },
    messages: {
      noEffectIgnore: "Do not use Effect.ignore. It silently discards errors which hides bugs. Handle errors explicitly with Effect.catchTag, Effect.catchAll, or propagate them."
    },
    schema: []
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object.type === "Identifier" &&
          node.object.name === "Effect" &&
          node.property.type === "Identifier" &&
          node.property.name === "ignore"
        ) {
          context.report({
            node,
            messageId: "noEffectIgnore"
          })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban Effect.catchAllCause usage.
 * catchAllCause catches defects (bugs) which should crash the program.
 * Use Effect.catchAll or Effect.catchTag for expected errors only.
 */
const noEffectCatchAllCauseRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Effect.catchAllCause - it catches defects which should not be caught"
    },
    messages: {
      noEffectCatchAllCause: "Do not use Effect.catchAllCause. It catches defects (bugs) which should crash the program. Use Effect.catchAll or Effect.catchTag to handle expected errors only."
    },
    schema: []
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object.type === "Identifier" &&
          node.object.name === "Effect" &&
          node.property.type === "Identifier" &&
          node.property.name === "catchAllCause"
        ) {
          context.report({
            node,
            messageId: "noEffectCatchAllCause"
          })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban silently swallowing errors with catch handlers that return Effect.void.
 * Patterns like:
 *   Effect.catchTag("SomeError", () => Effect.void)
 *   Effect.catchAll(() => Effect.void)
 *   .pipe(Effect.catchTag("SomeError", () => Effect.void))
 *
 * These silently discard errors which hides bugs. Errors should be:
 * - Logged and re-raised
 * - Transformed to a different error type
 * - Handled with meaningful recovery logic
 */
const noSilentErrorSwallowRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow catch handlers that silently swallow errors by returning Effect.void"
    },
    messages: {
      noSilentSwallow: "Do not silently swallow errors with '() => Effect.void'. Errors should be represented in the type system, not ignored. Either: (1) let the error propagate to the caller, (2) transform it with mapError to a different error type, or (3) handle it with meaningful recovery logic. Silent error swallowing hides bugs and breaks type safety."
    },
    schema: []
  },
  create(context) {
    // Check if a node is Effect.void or Effect.unit
    function isEffectVoidOrUnit(node) {
      if (!node) return false
      if (node.type === "MemberExpression") {
        return (
          node.object.type === "Identifier" &&
          node.object.name === "Effect" &&
          node.property.type === "Identifier" &&
          (node.property.name === "void" || node.property.name === "unit")
        )
      }
      return false
    }

    // Check if a node is an arrow function or function returning Effect.void
    function isVoidReturningHandler(node) {
      if (!node) return false

      // Arrow function: () => Effect.void
      if (node.type === "ArrowFunctionExpression") {
        // Direct return: () => Effect.void
        if (isEffectVoidOrUnit(node.body)) {
          return true
        }
        // Block with return: () => { return Effect.void }
        if (node.body.type === "BlockStatement") {
          const body = node.body.body
          if (body.length === 1 && body[0].type === "ReturnStatement") {
            return isEffectVoidOrUnit(body[0].argument)
          }
        }
      }

      // Regular function: function() { return Effect.void }
      if (node.type === "FunctionExpression") {
        const body = node.body.body
        if (body.length === 1 && body[0].type === "ReturnStatement") {
          return isEffectVoidOrUnit(body[0].argument)
        }
      }

      return false
    }

    // Check if a CallExpression is a catch method (catchTag, catchAll, catchTags)
    function isCatchCall(node) {
      if (node.type !== "CallExpression") return false
      const callee = node.callee

      // Effect.catchTag(), Effect.catchAll(), Effect.catchTags()
      if (callee.type === "MemberExpression") {
        const propName = callee.property.type === "Identifier" ? callee.property.name : null
        if (propName === "catchTag" || propName === "catchAll" || propName === "catchTags") {
          // Check if it's Effect.catchX or something.pipe(Effect.catchX)
          if (callee.object.type === "Identifier" && callee.object.name === "Effect") {
            return propName
          }
        }
      }

      return null
    }

    return {
      CallExpression(node) {
        const catchType = isCatchCall(node)
        if (!catchType) return

        // For catchTag("ErrorName", handler), handler is the second argument
        // For catchAll(handler), handler is the first argument
        // For catchTags({ ErrorName: handler }), check the object values
        let handlerArg = null

        if (catchType === "catchTag" && node.arguments.length >= 2) {
          handlerArg = node.arguments[1]
        } else if (catchType === "catchAll" && node.arguments.length >= 1) {
          handlerArg = node.arguments[0]
        } else if (catchType === "catchTags" && node.arguments.length >= 1) {
          // catchTags({ ErrorA: handler1, ErrorB: handler2 })
          const obj = node.arguments[0]
          if (obj.type === "ObjectExpression") {
            for (const prop of obj.properties) {
              if (prop.type === "Property" && isVoidReturningHandler(prop.value)) {
                context.report({
                  node: prop.value,
                  messageId: "noSilentSwallow"
                })
              }
            }
          }
          return
        }

        if (handlerArg && isVoidReturningHandler(handlerArg)) {
          context.report({
            node: handlerArg,
            messageId: "noSilentSwallow"
          })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban void expressions (e.g., void someValue).
 * void X is a no-op that evaluates X and discards the result.
 * This is usually a mistake or unnecessary.
 */
const noVoidExpressionRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow void expressions - they are no-ops"
    },
    messages: {
      noVoidExpression: "'void {{expression}}' is a no-op. It evaluates the expression and discards the result. Remove it or use the value."
    },
    schema: []
  },
  create(context) {
    return {
      UnaryExpression(node) {
        if (node.operator === "void") {
          const expression = context.getSourceCode().getText(node.argument)
          context.report({
            node,
            messageId: "noVoidExpression",
            data: { expression }
          })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban Effect.serviceOption usage.
 * Services should always be present in context, even during testing.
 * Using serviceOption makes it easy to forget to provide a service.
 */
const noServiceOptionRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Effect.serviceOption - services should always be present in context"
    },
    messages: {
      noServiceOption: "Do not use Effect.serviceOption. Services should always be present in context, even during testing. Yield the service directly (yield* MyService) and ensure it is provided in your layer composition."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        // Check for Effect.serviceOption()
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "Effect" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "serviceOption"
        ) {
          context.report({
            node,
            messageId: "noServiceOption"
          })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to warn when Layer.provide is nested inside another Layer.provide.
 * Nested Layer.provide calls are confusing and should be refactored.
 */
const noNestedLayerProvideRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow nested Layer.provide calls"
    },
    messages: {
      nestedProvide: "Nested Layer.provide detected. Extract the inner Layer.provide to a separate variable or use Layer.provideMerge."
    },
    schema: []
  },
  create(context) {
    function isLayerProvide(node) {
      if (node.type !== "CallExpression") return false
      const callee = node.callee
      return (
        callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        callee.object.name === "Layer" &&
        callee.property.type === "Identifier" &&
        callee.property.name === "provide"
      )
    }

    return {
      CallExpression(node) {
        if (!isLayerProvide(node)) return

        // Check if any argument is also a Layer.provide call
        for (const arg of node.arguments) {
          if (isLayerProvide(arg)) {
            context.report({
              node: arg,
              messageId: "nestedProvide"
            })
          }
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban window.location.href for navigation/redirects.
 * Use TanStack Router's navigate() or useNavigate() instead.
 * Direct location manipulation breaks SPA routing and loses app state.
 */
const noLocationHrefRedirectRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow window.location.href for redirects - use TanStack Router navigate() instead"
    },
    messages: {
      noLocationHref: "Do not use {{expression}} for navigation. Use TanStack Router's navigate() or useNavigate() hook instead. Direct location manipulation breaks SPA routing and loses all app state."
    },
    schema: []
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        const left = node.left
        if (left.type !== "MemberExpression") return
        if (left.property.type !== "Identifier") return

        const prop = left.property.name
        if (prop !== "href") return

        // Check if assigning to location.href or window.location.href
        const obj = left.object
        const isLocationHref =
          (obj.type === "Identifier" && obj.name === "location") ||
          (obj.type === "MemberExpression" &&
           obj.property.type === "Identifier" &&
           obj.property.name === "location" &&
           obj.object.type === "Identifier" &&
           (obj.object.name === "window" || obj.object.name === "document"))

        if (!isLocationHref) return

        // Get the expression text for the error message
        const expression = context.getSourceCode().getText(left)
        context.report({
          node,
          messageId: "noLocationHref",
          data: { expression }
        })
      }
    }
  }
}

const localPlugin = {
  rules: {
    "import-extensions": importExtensionsRule,
    "no-disable-validation": noDisableValidationRule,
    "no-sql-type-parameter": noSqlTypeParameterRule,
    "prefer-option-from-nullable": preferOptionFromNullableRule,
    "no-location-href-redirect": noLocationHrefRedirectRule,
    "no-direct-fetch": noDirectFetchRule,
    "no-localstorage": noLocalStorageRule,
    "pipe-max-arguments": pipeMaxArgumentsRule,
    "no-nested-layer-provide": noNestedLayerProvideRule,
    "no-service-option": noServiceOptionRule,
    "no-void-expression": noVoidExpressionRule,
    "no-effect-ignore": noEffectIgnoreRule,
    "no-effect-catchallcause": noEffectCatchAllCauseRule,
    "no-effect-asvoid": noEffectAsVoidRule,
    "no-silent-error-swallow": noSilentErrorSwallowRule
  }
}

export default [
  {
    ignores: [
      // Build outputs
      "**/dist/**",
      "**/build/**",
      "**/.output/**",
      "**/.next/**",
      "**/.turbo/**",

      // Dependencies
      "**/node_modules/**",

      // Playwright / E2E testing - include all file types
      "packages/web/playwright-report/**",
      "packages/web/test-results/**",
      "**/playwright-report/**",
      "**/playwright-report",
      "**/test-results/**",
      "**/test-results",
      "**/test-e2e/**",

      // Coverage
      "**/coverage/**",

      // Reference repos (git subtrees)
      "repos/**",

      // Generated files
      "**/*.gen.ts",
      "**/*.gen.tsx",

      // Other
      "**/*.md",
      "**/.ralph/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "local": localPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Import extension conventions
      "local/import-extensions": "error",
      // Ban disableValidation: true
      "local/no-disable-validation": "error",
      // Ban sql<Type>`...` - use SqlSchema with Schema instead
      "local/no-sql-type-parameter": "error",
      // Prefer Option.fromNullable over ternary
      "local/prefer-option-from-nullable": "error",
      // Use TanStack Router navigate() instead of location.href
      "local/no-location-href-redirect": "error",
      // Use openapi-fetch client instead of direct fetch()
      "local/no-direct-fetch": "error",
      // localStorage is forbidden - use httpOnly cookies for auth, React state for app state
      "local/no-localstorage": "error",
      // Error when .pipe() has too many arguments (max 20)
      "local/pipe-max-arguments": "error",
      // Error when Layer.provide is nested inside another Layer.provide
      "local/no-nested-layer-provide": "error",
      // Ban Effect.serviceOption - services should always be present in context
      "local/no-service-option": "error",
      // Ban void expressions - they are no-ops
      "local/no-void-expression": "error",
      // Ban Effect.ignore - errors should be explicitly handled
      "local/no-effect-ignore": "error",
      // Ban Effect.catchAllCause - it catches defects which should not be caught
      "local/no-effect-catchallcause": "error",
      // Ban Effect.asVoid - void already allows any value
      "local/no-effect-asvoid": "error",
      // Ban silently swallowing errors with () => Effect.void
      "local/no-silent-error-swallow": "error",
      // Allow unused variables starting with underscore
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      // Prohibit any and type assertions
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "never"
        }
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-namespace": "off",
      // Effect pattern: export both Schema constant and Type type with same name
      "no-redeclare": "off",
      // Effect uses generator functions that may not have explicit yield
      "require-yield": "off",
      // Prefer const assertions
      "prefer-const": "error",
      // Consistent type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports"
        }
      ],
      // Object shorthand
      "object-shorthand": "error",
      // No fallthrough in switch cases
      "no-fallthrough": "off",
      // Disable no-undef for TypeScript (TypeScript handles this)
      "no-undef": "off"
    }
  },
  {
    files: ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx"],
    rules: {
      // Disallow console in source files
      "no-console": "error"
    }
  },
  {
    files: ["packages/*/test/**/*.ts", "packages/*/test/**/*.tsx"],
    rules: {
      // Allow console in tests
      "no-console": "off"
    }
  },
  // Apply Prettier config to disable conflicting rules
  prettierConfig
]
