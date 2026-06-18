import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const restrictedImportRule = (patterns) => [
  "error",
  {
    patterns: patterns.map((pattern) => ({
      group: [pattern.group],
      message: pattern.message,
    })),
  },
];

const fsaaImportRestrictions = [
  {
    name: "fsaa/shared-imports",
    files: ["src/shared/**/*.ts", "src/shared/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictedImportRule([
        { group: "@/app/**", message: "❌ shared/ cannot import from app/." },
        {
          group: "@/pages/**",
          message: "❌ shared/ cannot import from pages/.",
        },
        {
          group: "@/features/**",
          message: "❌ shared/ cannot import from features/.",
        },
        {
          group: "@/entities/**",
          message: "❌ shared/ cannot import from entities/.",
        },
      ]),
    },
  },
  {
    name: "fsaa/entities-imports",
    files: ["src/entities/**/*.ts", "src/entities/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictedImportRule([
        { group: "@/app/**", message: "❌ entities/ cannot import from app/." },
        {
          group: "@/pages/**",
          message: "❌ entities/ cannot import from pages/.",
        },
        {
          group: "@/features/**",
          message: "❌ entities/ cannot import from features/.",
        },
      ]),
    },
  },
  {
    name: "fsaa/features-imports",
    files: ["src/features/**/*.ts", "src/features/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictedImportRule([
        { group: "@/app/**", message: "❌ features/ cannot import from app/." },
        {
          group: "@/pages/**",
          message: "❌ features/ cannot import from pages/.",
        },
      ]),
    },
  },
  {
    name: "fsaa/pages-imports",
    files: ["src/pages/**/*.ts", "src/pages/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictedImportRule([
        { group: "@/app/**", message: "❌ pages/ cannot import from app/." },
        {
          group: "@/entities/**",
          message:
            "❌ pages/ cannot import from entities/ directly. Use features instead.",
        },
      ]),
    },
  },
  {
    name: "fsaa/app-imports",
    files: ["src/app/**/*.ts", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictedImportRule([
        {
          group: "@/entities/**",
          message: "❌ app/ cannot import from entities/.",
        },
        {
          group: "@/features/**",
          message: "❌ app/ cannot import from features/. Use pages instead.",
        },
      ]),
    },
  },
  {
    name: "fsaa/app-api-exception",
    files: ["src/app/api/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    name: "fsaa/app-pages-exception",
    files: ["src/app/**/page.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...fsaaImportRestrictions,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
