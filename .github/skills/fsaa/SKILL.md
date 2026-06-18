---
name: fsaa
description: "Apply Feature-Sliced Architecture (FSA/FSAA) to Next.js projects. Use when restructuring a project into layers (app, pages, features, entities, shared), validating import dependencies, creating new features, or reviewing code against the FSAA dependency matrix."
argument-hint: "Describe the FSAA task: setup project, review imports, create feature, etc."
user-invocable: true
---

# Feature-Sliced Architecture (FSAA) Skill

## When to Use

- Restructuring an existing Next.js project into FSAA layers under `src/`
- Creating a new feature, entity, page, or shared component following FSAA
- Reviewing imports for FSAA compliance
- Setting up ESLint rules to enforce the FSAA dependency matrix

## FSAA Dependency Matrix

| Layer       | Can import from              | Cannot import from                         |
| ----------- | ---------------------------- | ------------------------------------------ |
| `shared/`   | other `shared/` modules only | `app/`, `pages/`, `features/`, `entities/` |
| `entities/` | `shared/`                    | `app/`, `pages/`, `features/`              |
| `features/` | `entities/`, `shared/`       | `app/`, `pages/`                           |
| `pages/`    | `features/`, `shared/`       | `app/`, `entities/` (directly)             |
| `app/`      | `pages/`, `shared/`          | `entities/`, `features/`                   |

Simple rule: import only **down** or on the **same** layer. Never up.

## Project Structure

```
src/
├── app/              # Next.js app router entry points
├── pages/            # Page compositions
├── features/         # User-facing features
├── entities/         # Business entities and rules
└── shared/           # Reusable UI, lib, config, tokens
```

## Procedure

### 1. Setup FSAA Structure

1. Create layer folders under `src/`: `app/`, `pages/`, `features/`, `entities/`, `shared/`
2. Move existing code into appropriate layers:
   - UI components → `shared/ui/`, `shared/atoms/`, `shared/molecules/`
   - Business constants/rules → `entities/<name>/`
   - Feature logic → `features/<name>/`
   - Page compositions → `pages/<name>/`
   - App router files → `app/`
3. Update `tsconfig.json` path alias: `"@/*": ["./src/*"]`
4. Use barrel `index.ts` exports for clean imports

### 2. Validate Imports

1. Check each import against the dependency matrix
2. Replace upward imports with proper layer indirection:
   - `pages/` needing `entities/` → import via `features/`
   - `app/` needing `features/` → import via `pages/`
3. Run `npm run build` to catch TypeScript errors
4. Run `npx eslint src --ext .ts,.tsx` if FSAA ESLint rules are configured

### 3. Enforce with ESLint

Add per-layer `no-restricted-imports` rules in `eslint.config.mjs`:

```js
const fsaaImportRestrictions = [
  {
    name: "fsaa/shared-imports",
    files: ["src/shared/**/*.ts", "src/shared/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: "@/app/**",
              message: "❌ shared/ cannot import from app/.",
            },
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
          ],
        },
      ],
    },
  },
  // ... repeat for entities, features, pages, app
];
```

### 4. Create a New Feature

1. Create folder `src/features/<feature-name>/`
2. Add subfolders: `api/`, `ui/`, `model/`, `lib/` as needed
3. Export public API through `src/features/<feature-name>/index.ts`
4. Import only from `entities/` and `shared/`
5. Use shared atoms/molecules for UI, never import from `pages/` or `app/`

## Quality Checks

- [ ] `npm run build` passes
- [ ] `npx eslint src --ext .ts,.tsx` passes (if FSAA rules enabled)
- [ ] No upward imports across layers
- [ ] Each layer has clear public API via barrel exports
- [ ] `shared/` contains no business logic from `entities/` or `features/`

## Common Mistakes

- `shared/` importing `entities/` or `features/`
- `entities/` importing UI components from `shared/atoms/`
- `pages/` importing `entities/` directly instead of through `features/`
- `app/` importing `features/` directly instead of through `pages/`
- Forgetting `export type` for type-only re-exports with `isolatedModules`
