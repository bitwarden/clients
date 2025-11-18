---
name: angular-modernization
description: Modernizes Angular code such as components and directives to follow best practices using both automatic CLI migrations and Bitwarden-specific patterns. YOU must use this skill when someone requests modernization of Angular code.
allowed-tools: Read, Write, Glob
---

# Angular Modernization

Transforms legacy Angular components to modern architecture using a two-step approach:

1. **Automated migrations** - Angular CLI schematics for standalone, control flow, and signals
2. **Bitwarden patterns** - ADR compliance, OnPush change detection, proper visibility, thin components

## When to Use

- Refactoring legacy Angular components
- Converting to standalone architecture
- Updating to modern template syntax
- Adding OnPush change detection
- Migrating to signal-based APIs

## Workflow

### Step 1: Run Angular CLI Migrations

**⚠️ CRITICAL: ALWAYS use Angular CLI migrations when available. NEVER manually migrate features that have CLI schematics.**

Angular provides automated schematics that handle edge cases, update tests, and ensure correctness. Manual migration should ONLY be used for patterns not covered by CLI tools.

**IMPORTANT:**

- Always run the commands using `npx ng`.
- All the commands must be run on directories and NOT files. Use the `--path` option to target directories.
- Run migrations in order (some depend on others)

#### 1. Standalone Components

```bash
npx ng generate @angular/core:standalone --path=<directory> --mode=convert-to-standalone
```

NgModule-based → standalone architecture

#### 2. Control Flow Syntax

```bash
npx ng generate @angular/core:control-flow
```

`*ngIf`, `*ngFor`, `*ngSwitch` → `@if`, `@for`, `@switch`

#### 3. Signal Inputs

```bash
npx ng generate @angular/core:signal-input-migration
```

`@Input()` → signal inputs

#### 4. Signal Outputs

```bash
npx ng generate @angular/core:output-migration
```

`@Output()` → signal outputs

#### 5. Signal Queries

```bash
npx ng generate @angular/core:signal-queries-migration
```

`@ViewChild`, `@ContentChild`, etc. → signal queries

#### 6. inject() Function

```bash
npx ng generate @angular/core:inject-migration
```

Constructor injection → `inject()` function

#### 7. Unused Imports

```bash
npx ng generate @angular/core:unused-imports
```

Removes unused imports

### Step 2: Apply Bitwarden Patterns

See [migration-patterns.md](migration-patterns.md) for detailed examples.

1. Add OnPush change detection
2. Apply visibility modifiers (`protected` for template access, `private` for internal)
3. Convert local component state to signals
4. Keep service observables (don't convert to signals)
5. Extract business logic to services
6. Organize class members correctly
7. Update tests for standalone

### Step 3: Validate

- Fix linting and formatting using `npm run lint:fix`
- Run tests using `npm run test`

If any errors occur, fix them accordingly.

## Key Decisions

### Signals vs Observables

- **Signals** - Component-local state only (ADR-0027)
- **Observables** - Service state and cross-component communication (ADR-0003)
- Use `toSignal()` to bridge observables into signal-based components

### Visibility

- `protected` - Template-accessible members
- `private` - Internal implementation

### Other Rules

- Always add OnPush change detection
- No TypeScript enums (use const objects with type aliases per ADR-0025)
- No code regions (refactor instead)
- Thin components (business logic in services)

See [migration-patterns.md](migration-patterns.md) for code examples.

## Validation Checklist

Before completing migration:

- [ ] OnPush change detection added
- [ ] Visibility modifiers applied (`protected`/`private`)
- [ ] Signals for component state, observables for service state
- [ ] Class members organized (see [migration-patterns.md](migration-patterns.md#class-member-organization))
- [ ] Tests updated and passing
- [ ] No new TypeScript enums
- [ ] No code regions

## References

### Detailed Guides

- [cli-migrations.md](cli-migrations.md) - Angular CLI migration commands
- [migration-patterns.md](migration-patterns.md) - Code patterns and examples

### Bitwarden ADRs

- [ADR-0003: Observable Data Services](https://contributing.bitwarden.com/architecture/adr/observable-data-services)
- [ADR-0025: No TypeScript Enums](https://contributing.bitwarden.com/architecture/adr/no-enums)
- [ADR-0027: Angular Signals](https://contributing.bitwarden.com/architecture/adr/angular-signals)
- [Bitwarden Angular Style Guide](https://contributing.bitwarden.com/contributing/code-style/web/angular)

### Angular Resources

- [Angular Style Guide](https://angular.dev/style-guide)
- [Angular Migrations](https://angular.dev/reference/migrations)
- [Angular CLI Schematics](https://angular.dev/tools/cli/schematics)
