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

const localPlugin = {
  rules: {
    "import-extensions": importExtensionsRule,
    "no-disable-validation": noDisableValidationRule,
    "no-sql-type-parameter": noSqlTypeParameterRule,
    "prefer-option-from-nullable": preferOptionFromNullableRule
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
