---
name: fix-angular-fixmes
description: Resolves eslint-disable suppression comments throughout the Bitwarden clients codebase by fixing the underlying issue. Use when the user asks to "fix FIXMEs", "fix eslint suppressions", "clean up eslint-disable-next-line", "resolve CL-764", "resolve CL-903", "fix OnPush eslint suppressions", "fix Signals eslint suppressions", or reduce linting suppressions.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npx ng generate:*), Bash(npm run lint:fix), Bash(npm run test)
---

## Key rules

- Fix the underlying issue — never just delete the suppression comment and leave broken code.
- Remove the **complete comment block**: FIXME line (if any) + TODO: Skipped block (if any) + eslint-disable-next-line line.
- Both FIXME-paired and standalone suppressions are the same migration debt.
- For Angular migration rules, prefer CLI schematics over manual edits.
- Do NOT convert service observables to signals (ADR-0027).
- For OnPush and signals patterns, the `angular-modernization` skill is the authoritative source — this skill only owns the ESLint suppression mechanics.

## Step 1: Discover all suppressions

Use the `Grep` tool to find suppressions in the target path:

- Pattern `eslint-disable` — finds all eslint suppressions
- Pattern `FIXME.*CL-` — finds Angular FIXME-tracked ones specifically

Group results by rule name. Two forms appear in this codebase:

**Form A — FIXME-paired** (a FIXME tracking comment sits above the disable):

```typescript
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
```

**Form B — Standalone** (disable without a FIXME, or with a CLI skip comment):

```typescript
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
// TODO: Skipped for signal migration because:
//  Accessor inputs cannot be migrated as they are too complex.
// FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
// eslint-disable-next-line @angular-eslint/prefer-signals
```

Both forms must be fixed the same way.

## Rule reference

| Category         | Rule                                                        | Section below                                       |
| ---------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| Angular          | `@angular-eslint/prefer-on-push-component-change-detection` | [OnPush](#onpush)                                   |
| Angular          | `@angular-eslint/prefer-signals`                            | [Signals](#signals)                                 |
| Angular          | `@angular-eslint/prefer-output-emitter-ref`                 | [Signals](#signals)                                 |
| Angular template | `@angular-eslint/template/button-has-type`                  | [HTML rules](#html-rules)                           |
| TypeScript       | `@typescript-eslint/no-floating-promises`                   | [no-floating-promises](#no-floating-promises)       |
| TypeScript       | `@typescript-eslint/no-unused-vars`                         | [no-unused-vars](#no-unused-vars)                   |
| TypeScript       | `@typescript-eslint/no-unsafe-function-type`                | [no-unsafe-function-type](#no-unsafe-function-type) |
| RxJS             | `rxjs/no-async-subscribe`                                   | [rxjs rules](#rxjs-rules)                           |
| RxJS             | `rxjs-angular/prefer-takeuntil`                             | [rxjs rules](#rxjs-rules)                           |
| Bitwarden        | `@bitwarden/platform/no-enums`                              | [no-enums](#no-enums)                               |
| Bitwarden        | `@bitwarden/components/no-bwi-class-usage`                  | [HTML rules](#html-rules)                           |
| General          | `no-restricted-imports`                                     | [no-restricted-imports](#no-restricted-imports)     |
| General          | `no-console`                                                | [no-console](#no-console)                           |
| General          | `no-empty`                                                  | [no-empty](#no-empty)                               |
| General          | bare `// eslint-disable-next-line`                          | [bare disable](#bare-disable)                       |
| Tailwind         | `tailwindcss/no-custom-classname`                           | [HTML rules](#html-rules)                           |

## OnPush

**Rule:** `@angular-eslint/prefer-on-push-component-change-detection`

Follow the OnPush guidance in the `angular-modernization` skill (add `changeDetection: ChangeDetectionStrategy.OnPush`, remove `ChangeDetectorRef` if only used for `detectChanges()`). Then remove the FIXME + `eslint-disable-next-line` lines.

> `@Directive` does not support `changeDetection` — skip OnPush for pure directives.

## Signals

**Rules:** `@angular-eslint/prefer-signals`, `@angular-eslint/prefer-output-emitter-ref`

Applies to `@Input()`, `@Output()`, `@ViewChild`, `@ContentChild`.

Follow the Signal Inputs, Outputs, and Queries guidance in the `angular-modernization` skill (prefer CLI schematics, then manual conversion). After each migration, **manually remove** the FIXME and `eslint-disable-next-line` lines, and any `// TODO: Skipped for signal migration because:` comment blocks.

> Do NOT convert service observables to signals — only component-local state and decorator bindings (ADR-0027).

## no-floating-promises

**Rule:** `@typescript-eslint/no-floating-promises`

A returned Promise is not handled. Pick one fix:

```typescript
// 1. Await it (preferred in async functions)
await this.router.navigate(["/login"]);

// 2. void — explicit fire-and-forget
void this.router.navigate(["/login"]);

// 3. Chain .catch() for explicit error handling
this.router.navigate(["/login"]).catch((err) => this.logService.error(err));
```

Use `void` for navigation or toast calls that genuinely don't need awaiting. Use `await` when the result matters or you're already in an async context.

## no-unused-vars

**Rule:** `@typescript-eslint/no-unused-vars`

```typescript
// Remove unused variable
const unused = computeSomething(); // delete this line

// Or prefix with _ if it must be declared (e.g. destructuring)
const [_first, second] = array;

// Or suppress a catch variable (TypeScript 4.0+)
try { ... } catch { ... } // omit the variable entirely
```

## no-unsafe-function-type

**Rule:** `@typescript-eslint/no-unsafe-function-type`

Replace the generic `Function` type with a specific signature:

**Before**

```typescript
private callback: Function;
```

**After** — use the actual signature

```typescript
private callback: () => void;
// or for unknown signatures:
private callback: (...args: unknown[]) => unknown;
```

## RxJS rules

**Rules:** `rxjs/no-async-subscribe`, `rxjs-angular/prefer-takeuntil`

**`rxjs/no-async-subscribe`** — async callback inside `.subscribe()` swallows errors:

**Before**

```typescript
this.service.data$.subscribe(async (value) => {
  await this.process(value);
});
```

**After** — move async work into the pipe

```typescript
this.service.data$
  .pipe(
    switchMap((value) => this.process(value)),
    takeUntilDestroyed(),
  )
  .subscribe();
```

**`rxjs-angular/prefer-takeuntil`** — subscription without cleanup:

**Before**

```typescript
this.service.data$.subscribe((value) => {
  this.data = value;
});
```

**After** — add `takeUntilDestroyed()` (call in constructor or use `destroyRef`)

```typescript
constructor() {
  this.service.data$
    .pipe(takeUntilDestroyed())
    .subscribe((value) => { this.data = value; });
}
```

## no-enums

**Rule:** `@bitwarden/platform/no-enums`

Convert TypeScript enums to const objects with type aliases (ADR-0025):

**Before**

```typescript
enum CipherType {
  Login = 1,
  SecureNote = 2,
}
```

**After**

```typescript
export const CipherType = Object.freeze({ Login: 1, SecureNote: 2 } as const);
export type CipherType = (typeof CipherType)[keyof typeof CipherType];
```

Update all import sites — the usage (`CipherType.Login`) stays the same.

## no-restricted-imports

**Rule:** `no-restricted-imports`

The import is from a path that the ESLint config forbids. Steps:

1. Read the context around the import to understand what is being imported.
2. Check `eslint.config.mjs` at the repo root (or the nearest config) for the `no-restricted-imports` rule to find the allowed alternative path.
3. Replace the import with the allowed path and remove the suppression.

Common cases: importing platform-internal modules directly instead of through the public API, or test-only helpers in non-test files.

## no-console

**Rule:** `no-console`

```typescript
// Remove debug statements
console.log("debug"); // delete

// Replace with the application logging service
this.logService.error("Something failed", error);
```

In test files (`*.spec.ts`), a `console.error` or `console.warn` spy may be intentional — in that case, set up the spy properly rather than suppressing:

```typescript
jest.spyOn(console, "error").mockImplementation(() => {});
```

## no-empty

**Rule:** `no-empty`

Empty `catch` blocks silently swallow errors:

**Before**

```typescript
try {
  await something();
  // eslint-disable-next-line no-empty
} catch {}
```

**After** — handle or log the error

```typescript
try {
  await something();
} catch (e) {
  // Intentionally ignored — operation is best-effort
}

// Or log it
try {
  await something();
} catch (e) {
  this.logService.warning("Operation failed", e);
}
```

## Bare disable

**Rule:** bare `// eslint-disable-next-line` (no rule specified)

This disables ALL rules for the next line, which is always wrong. Steps:

1. Remove the suppression and run `npm run lint:fix` to see which specific rule triggers.
2. Fix the underlying issue using the appropriate section above.
3. If the violation truly cannot be fixed (rare), replace the bare disable with a specific named rule.

## HTML rules

**`@angular-eslint/template/button-has-type`** — Add an explicit type to every `<button>`:

**Before**

```html
<button (click)="save()">Save</button>
```

**After**

```html
<button type="button" (click)="save()">Save</button>
<!-- or type="submit" inside a <form> -->
```

**`@bitwarden/components/no-bwi-class-usage`** — Replace raw `bwi-*` icon classes with the `<bit-icon>` component or the appropriate icon token.

**`tailwindcss/no-custom-classname`** — Use a Tailwind utility class with the `tw-` prefix, or register the class in the Tailwind safelist. Never use arbitrary custom class names.

## Step 2: Cleanup checklist per fixed instance

- [ ] `// FIXME(…)` line removed (if present)
- [ ] `// TODO: Skipped for signal migration because: …` block removed (all lines, if present)
- [ ] `// eslint-disable-next-line …` line removed
- [ ] Unused imports removed; new imports added as needed
- [ ] All in-class usages updated (e.g. signal reads need `()`)

## Step 3: Validate

```bash
npm run lint:fix
```

Fix any errors that remain. Run `npm run test` if behaviour-critical code was changed.
