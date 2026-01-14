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
 * Custom ESLint rule to ban window.location.reload() and similar page reload tricks.
 * Use useAtomRefresh() or reactivityKeys instead of full page reloads.
 * See specs/EFFECT_ATOM.md Section 4.1
 */
const noPageReloadRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow page reload methods - use useAtomRefresh() or reactivityKeys instead"
    },
    messages: {
      noReload: "Do not use {{method}}. Use useAtomRefresh() to refresh specific atoms or reactivityKeys for automatic invalidation. Page reloads destroy all state and provide poor UX.",
      noLocationAssign: "Do not assign to {{property}} for reloading. Use useAtomRefresh() or reactivityKeys instead."
    },
    schema: []
  },
  create(context) {
    return {
      // Catch: window.location.reload(), location.reload(), document.location.reload()
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression") return
        if (callee.property.type !== "Identifier" || callee.property.name !== "reload") return

        const obj = callee.object
        // Direct: location.reload()
        if (obj.type === "Identifier" && obj.name === "location") {
          context.report({ node, messageId: "noReload", data: { method: "location.reload()" } })
          return
        }
        // window.location.reload() or document.location.reload()
        if (obj.type === "MemberExpression" &&
            obj.property.type === "Identifier" &&
            obj.property.name === "location") {
          const base = obj.object
          if (base.type === "Identifier" && (base.name === "window" || base.name === "document")) {
            context.report({ node, messageId: "noReload", data: { method: `${base.name}.location.reload()` } })
          }
        }
      },
      // Catch: window.location.href = window.location.href (reload trick)
      AssignmentExpression(node) {
        const left = node.left
        if (left.type !== "MemberExpression") return
        if (left.property.type !== "Identifier") return

        const prop = left.property.name
        if (prop !== "href" && prop !== "pathname") return

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

        // Check if right side references same location (self-assignment = reload)
        const right = node.right
        const sourceText = context.getSourceCode().getText(right)
        if (sourceText.includes("location.href") || sourceText.includes("location.pathname")) {
          context.report({
            node,
            messageId: "noLocationAssign",
            data: { property: `location.${prop}` }
          })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban the refreshKey anti-pattern with atoms.
 * Using useState refreshKey in useMemo deps creates new atoms on every "refresh".
 * Use useAtomRefresh() instead.
 * See specs/EFFECT_ATOM.md Section 4.2
 */
const noRefreshKeyPatternRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow refreshKey pattern for atom refresh - use useAtomRefresh() instead"
    },
    messages: {
      noRefreshKey: "Do not use refreshKey/forceUpdate state to refresh atoms. This creates new atom instances and loses memoization. Use useAtomRefresh(atom) instead."
    },
    schema: []
  },
  create(context) {
    // Track useState calls that look like refresh keys
    const refreshKeyStates = new Set()

    return {
      // Find useState calls with names suggesting refresh key pattern
      VariableDeclarator(node) {
        if (node.init?.type !== "CallExpression") return
        const callee = node.init.callee

        // Check for useState() or React.useState()
        const isUseState =
          (callee.type === "Identifier" && callee.name === "useState") ||
          (callee.type === "MemberExpression" &&
           callee.object.type === "Identifier" &&
           callee.object.name === "React" &&
           callee.property.type === "Identifier" &&
           callee.property.name === "useState")

        if (!isUseState) return

        // Check if destructured name suggests refresh key
        if (node.id.type !== "ArrayPattern") return
        const firstName = node.id.elements[0]
        if (firstName?.type !== "Identifier") return

        const name = firstName.name.toLowerCase()
        const refreshKeyNames = ["refreshkey", "refreshcount", "forceupdate", "updatekey", "reloadkey", "invalidatekey"]
        if (refreshKeyNames.some(rk => name.includes(rk.toLowerCase()))) {
          refreshKeyStates.add(firstName.name)
        }
      },
      // Check useMemo deps for refresh key usage with atom creation
      CallExpression(node) {
        const callee = node.callee

        // Check for useMemo() or React.useMemo()
        const isUseMemo =
          (callee.type === "Identifier" && callee.name === "useMemo") ||
          (callee.type === "MemberExpression" &&
           callee.object.type === "Identifier" &&
           callee.object.name === "React" &&
           callee.property.type === "Identifier" &&
           callee.property.name === "useMemo")

        if (!isUseMemo) return
        if (node.arguments.length < 2) return

        const deps = node.arguments[1]
        if (deps.type !== "ArrayExpression") return

        // Check if deps include a refresh key variable
        const hasRefreshKeyDep = deps.elements.some(el =>
          el?.type === "Identifier" && refreshKeyStates.has(el.name)
        )

        if (!hasRefreshKeyDep) return

        // Check if the memo body creates an atom (ApiClient.query, Atom.*, etc.)
        const memoBody = node.arguments[0]
        const bodyText = context.getSourceCode().getText(memoBody)

        const atomCreationPatterns = [
          "ApiClient.query",
          "ApiClient.mutation",
          "Atom.make",
          "Atom.readable",
          "Atom.writable",
          "Atom.family",
          "createAtom",
          "QueryAtom",
          "MutationAtom"
        ]

        if (atomCreationPatterns.some(pattern => bodyText.includes(pattern))) {
          context.report({ node, messageId: "noRefreshKey" })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to warn about creating atoms inside render without memoization.
 * Atoms created on every render cause new subscriptions and lose cache benefits.
 * See specs/EFFECT_ATOM.md Section 4.3
 */
const noUnmemoizedAtomCreationRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow creating atoms inside components without useMemo or Atom.family"
    },
    messages: {
      unmemoizedAtom: "Atom created inside component without memoization. Use Atom.family() for parameterized atoms or wrap in useMemo() with stable dependencies. Creating atoms on every render causes performance issues."
    },
    schema: []
  },
  create(context) {
    // Track if we're inside a function component
    let componentDepth = 0
    let inUseMemo = false

    function isComponentFunction(node) {
      // Function starting with uppercase letter (React convention)
      if (node.id?.type === "Identifier") {
        return /^[A-Z]/.test(node.id.name)
      }
      // Arrow function assigned to uppercase variable
      if (node.parent?.type === "VariableDeclarator" &&
          node.parent.id?.type === "Identifier") {
        return /^[A-Z]/.test(node.parent.id.name)
      }
      return false
    }

    function isAtomCreation(node) {
      if (node.type !== "CallExpression") return false
      const callee = node.callee

      // ApiClient.query() or ApiClient.mutation()
      if (callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "ApiClient" &&
          callee.property.type === "Identifier" &&
          (callee.property.name === "query" || callee.property.name === "mutation")) {
        return true
      }

      // Atom.make(), Atom.readable(), Atom.writable()
      if (callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "Atom" &&
          callee.property.type === "Identifier" &&
          ["make", "readable", "writable"].includes(callee.property.name)) {
        return true
      }

      return false
    }

    return {
      // Track entering component functions
      "FunctionDeclaration"(node) {
        if (isComponentFunction(node)) componentDepth++
      },
      "FunctionDeclaration:exit"(node) {
        if (isComponentFunction(node)) componentDepth--
      },
      "FunctionExpression"(node) {
        if (isComponentFunction(node)) componentDepth++
      },
      "FunctionExpression:exit"(node) {
        if (isComponentFunction(node)) componentDepth--
      },
      "ArrowFunctionExpression"(node) {
        if (isComponentFunction(node)) componentDepth++
      },
      "ArrowFunctionExpression:exit"(node) {
        if (isComponentFunction(node)) componentDepth--
      },

      // Track useMemo calls
      "CallExpression"(node) {
        const callee = node.callee
        const isUseMemo =
          (callee.type === "Identifier" && callee.name === "useMemo") ||
          (callee.type === "MemberExpression" &&
           callee.object.type === "Identifier" &&
           callee.object.name === "React" &&
           callee.property.type === "Identifier" &&
           callee.property.name === "useMemo")

        if (isUseMemo && node.arguments[0]) {
          inUseMemo = true
        }

        // Check for unmemoized atom creation inside components
        if (componentDepth > 0 && !inUseMemo && isAtomCreation(node)) {
          // Check if it's inside a variable declaration at component level
          // (not inside a callback or other nested function)
          let parent = node.parent
          while (parent) {
            // If inside useMemo callback, it's fine
            if (parent.type === "CallExpression") {
              const c = parent.callee
              if ((c.type === "Identifier" && c.name === "useMemo") ||
                  (c.type === "MemberExpression" && c.property?.name === "useMemo")) {
                return
              }
            }
            // If inside useCallback, useEffect, etc., it's likely intentional
            if (parent.type === "CallExpression") {
              const c = parent.callee
              if (c.type === "Identifier" &&
                  ["useCallback", "useEffect", "useLayoutEffect"].includes(c.name)) {
                return
              }
            }
            parent = parent.parent
          }

          context.report({ node, messageId: "unmemoizedAtom" })
        }
      },
      "CallExpression:exit"(node) {
        const callee = node.callee
        const isUseMemo =
          (callee.type === "Identifier" && callee.name === "useMemo") ||
          (callee.type === "MemberExpression" &&
           callee.object.type === "Identifier" &&
           callee.object.name === "React" &&
           callee.property.type === "Identifier" &&
           callee.property.name === "useMemo")

        if (isUseMemo) {
          inUseMemo = false
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban TanStack Start server functions.
 * Use HttpApiClient with ManagedRuntime instead for server-side data fetching.
 * Server functions bypass type safety, schema validation, and the Effect ecosystem.
 */
const noServerFunctionsRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow TanStack Start server functions - use HttpApiClient with ManagedRuntime instead"
    },
    messages: {
      noServerFn: "Do not use createServerFn(). Use HttpApiClient with a ManagedRuntime for server-side data fetching. Server functions bypass type safety and schema validation.",
      noServerFnImport: "Do not import createServerFn from @tanstack/react-start. Use HttpApiClient with ManagedRuntime instead."
    },
    schema: []
  },
  create(context) {
    return {
      // Catch: import { createServerFn } from "@tanstack/react-start"
      ImportDeclaration(node) {
        if (node.source.value !== "@tanstack/react-start" &&
            node.source.value !== "@tanstack/start") {
          return
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" &&
              specifier.imported.type === "Identifier" &&
              specifier.imported.name === "createServerFn") {
            context.report({ node: specifier, messageId: "noServerFnImport" })
          }
        }
      },
      // Catch: createServerFn() calls
      CallExpression(node) {
        const callee = node.callee

        // Direct createServerFn() call
        if (callee.type === "Identifier" && callee.name === "createServerFn") {
          context.report({ node, messageId: "noServerFn" })
        }
      }
    }
  }
}

/**
 * Custom ESLint rule to ban direct fetch() usage.
 * Use HttpApiClient (ApiClient) generated from the API spec instead.
 * Direct fetch bypasses type safety, authentication handling, and error handling.
 */
const noDirectFetchRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow direct fetch() usage - use ApiClient from HttpApiClient instead"
    },
    messages: {
      noDirectFetch: "Do not use fetch() directly. Use ApiClient.query() or ApiClient.mutation() from the auto-generated HttpApiClient instead. This provides type safety, automatic authentication, and proper error handling."
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
    "no-page-reload": noPageReloadRule,
    "no-refresh-key-pattern": noRefreshKeyPatternRule,
    "no-unmemoized-atom-creation": noUnmemoizedAtomCreationRule,
    "no-location-href-redirect": noLocationHrefRedirectRule,
    "no-direct-fetch": noDirectFetchRule,
    "no-server-functions": noServerFunctionsRule
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
      // Effect Atom anti-patterns (see specs/EFFECT_ATOM.md)
      "local/no-page-reload": "error",
      "local/no-refresh-key-pattern": "error",
      "local/no-unmemoized-atom-creation": "error",
      // Use TanStack Router navigate() instead of location.href
      "local/no-location-href-redirect": "error",
      // Use ApiClient instead of direct fetch()
      "local/no-direct-fetch": "error",
      // Use HttpApiClient with ManagedRuntime instead of server functions
      "local/no-server-functions": "error",
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
