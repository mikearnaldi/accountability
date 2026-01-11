import js from "@eslint/js"
import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import prettierConfig from "eslint-config-prettier"

/**
 * Custom ESLint rule to enforce import extension conventions:
 * - Relative imports (./foo or ../foo) must use .ts extension
 * - Package imports (effect/Schema, @effect/sql) must be extensionless
 */
const importExtensionsRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce .ts extension for relative imports and no extension for package imports"
    },
    messages: {
      relativeRequiresTs: "Relative imports must use .ts extension. Change '{{source}}' to '{{source}}.ts'",
      relativeNoJs: "Relative imports must use .ts extension, not .js. Change '{{source}}' to '{{fixed}}'",
      packageNoExtension: "Package imports must not have an extension. Change '{{source}}' to '{{fixed}}'"
    },
    schema: []
  },
  create(context) {
    function checkImportSource(node, source) {
      if (!source || typeof source !== "string") return

      const isRelative = source.startsWith("./") || source.startsWith("../")

      if (isRelative) {
        // Relative imports must use .ts
        if (source.endsWith(".js")) {
          const fixed = source.replace(/\.js$/, ".ts")
          context.report({
            node,
            messageId: "relativeNoJs",
            data: { source, fixed }
          })
        } else if (!source.endsWith(".ts") && !source.endsWith(".json")) {
          // Missing extension on relative import
          context.report({
            node,
            messageId: "relativeRequiresTs",
            data: { source }
          })
        }
      } else {
        // Package imports must be extensionless
        if (source.endsWith(".ts") || source.endsWith(".js")) {
          const fixed = source.replace(/\.(ts|js)$/, "")
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
 * Custom ESLint rule to warn against ReadonlyArray usage.
 * ReadonlyArray doesn't support structural equality (Equal/Hash).
 * Use Chunk from effect instead for collections that need value-based equality.
 */
const noReadonlyArrayRule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn against ReadonlyArray usage, prefer Chunk for structural equality support"
    },
    messages: {
      preferChunk: "Avoid ReadonlyArray - it doesn't support structural equality. Use Chunk from 'effect' instead, which implements Equal/Hash for value-based comparison."
    },
    schema: []
  },
  create(context) {
    return {
      // Catch type references like: ReadonlyArray<T>
      TSTypeReference(node) {
        const typeName = node.typeName
        if (typeName.type === "Identifier" && typeName.name === "ReadonlyArray") {
          context.report({
            node,
            messageId: "preferChunk"
          })
        }
      }
    }
  }
}

const localPlugin = {
  rules: {
    "import-extensions": importExtensionsRule,
    "no-readonly-array": noReadonlyArrayRule
  }
}

export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "repos/**",
      "**/*.md"
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
      // Prefer Chunk over ReadonlyArray for structural equality (disabled for now)
      "local/no-readonly-array": "off",
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
        "warn",
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
