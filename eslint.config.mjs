import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // AD-4 import boundary: the ops console and tenant route trees never import
  // each other; shared primitives live in src/components/ui and src/lib.
  {
    files: ["src/**"],
    ignores: ["src/app/ops/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/ops/**", "**/app/ops/**"],
              message: "Tenant surfaces may not import from the ops console tree (AD-4)",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/ops/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/**", "!@/app/ops", "!@/app/ops/**"],
              message: "The ops console may not import from tenant route trees (AD-4)",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
