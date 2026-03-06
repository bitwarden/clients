---
name: fix-angular-fixmes
description: Resolves Angular FIXME migration comments in the Bitwarden clients codebase. Use when the user asks to "fix FIXMEs", "resolve CL-764", "resolve CL-903", "migrate to OnPush", "migrate to Signals", or wants to clean up eslint-disable suppression comments tied to Angular modernization tickets.
allowed-tools: Read, Write, StrReplace, Glob, Grep, Bash(npx ng generate:*), Bash(npm run lint:fix), Bash(npm run test)
---

# Fix Angular FIXMEs

Resolves the two recurring FIXME migration comments found across the codebase. Each FIXME is always paired with an `eslint-disable-next-line` suppression that must be removed along with it.

## Step 1: Discover FIXMEs

Search for all FIXME comments in the target file(s) or directory:

```bash
# In a specific file
rg "FIXME.*CL-" <path>

# Across the whole repo
rg "FIXME.*CL-\d+.*Migrate" --glob "*.ts"
```

Identify which ticket(s) are present: **CL-764** (OnPush) and/or **CL-903** (Signals).

---

## CL-764: Migrate to OnPush

### Pattern to find

```typescript
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "...",
  imports: [...],
})
```

### Fix

1. Add `changeDetection: ChangeDetectionStrategy.OnPush` to the `@Component` (or `@Directive`) decorator.
2. Add `ChangeDetectionStrategy` to the `@angular/core` import if not already present.
3. Remove the two comment lines (FIXME + eslint-disable).
4. Remove `ChangeDetectorRef` from the constructor/inject calls if its only use was `detectChanges()` calls that are no longer needed with OnPush. If it's still used for other purposes, keep it.

### Before → After

**Before:**

```typescript
import { ChangeDetectorRef, Component } from "@angular/core";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "my.component.html",
  imports: [SharedModule],
})
export class MyComponent {
  private cdr = inject(ChangeDetectorRef);

  async load() {
    await doWork();
    this.cdr.detectChanges();
  }
}
```

**After:**

```typescript
import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  templateUrl: "my.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyComponent {
  async load() {
    await doWork();
  }
}
```

> If `ChangeDetectorRef` is still required (e.g. embedded views, `markForCheck()`), keep it — only remove it when the sole usage was `detectChanges()`.

---

## CL-903: Migrate to Signals

### Pattern to find

The `eslint-disable` rule differs per decorator type:

| Decorator                      | Suppression rule                            |
| ------------------------------ | ------------------------------------------- |
| `@Input()`                     | `@angular-eslint/prefer-signals`            |
| `@Output()`                    | `@angular-eslint/prefer-output-emitter-ref` |
| `@ViewChild` / `@ContentChild` | `@angular-eslint/prefer-signals`            |

### Fix using Angular CLI (preferred)

**Always use CLI schematics when migrating a whole file or directory.** See the `angular-modernization` skill for full CLI command reference.

```bash
# Signal inputs (@Input → input())
npx ng generate @angular/core:signal-input-migration --path=<directory>

# Signal outputs (@Output → output())
npx ng generate @angular/core:output-migration --path=<directory>

# Signal queries (@ViewChild/@ContentChild → viewChild()/contentChild())
npx ng generate @angular/core:signal-queries-migration --path=<directory>
```

After CLI migration, the FIXME and `eslint-disable-next-line` lines will still be present — **remove them manually** for each resolved instance.

### Manual fix (when CLI cannot handle a specific case)

**`@Input()` → `input()`:**

```typescript
// Before
// FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
// eslint-disable-next-line @angular-eslint/prefer-signals
@Input() activeFilter: VaultFilter = new VaultFilter();

// After
activeFilter = input<VaultFilter>(new VaultFilter());
```

**`@Output()` → `output()`:**

```typescript
// Before
// FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
// eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
@Output() onEditFolder = new EventEmitter<FolderFilter>();

// After
onEditFolder = output<FolderFilter>();
```

**`@ViewChild` / `@ContentChild` → `viewChild()` / `contentChild()`:**

```typescript
// Before
// FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
// eslint-disable-next-line @angular-eslint/prefer-signals
@ViewChild("policyForm", { read: ViewContainerRef, static: true })
policyFormRef: ViewContainerRef | undefined;

// After
policyFormRef = viewChild<ViewContainerRef>("policyForm", { read: ViewContainerRef });
```

### Import changes for CL-903

Remove decorator imports that are no longer used (`Input`, `Output`, `ViewChild`, `ContentChild`, `EventEmitter`) and add signal equivalents (`input`, `output`, `viewChild`, `contentChild`) from `@angular/core`.

### Accessing signal values in the class

Signal inputs and queries are functions — call them to read the value:

```typescript
// Before (decorator)
if (!this.policyFormRef) { ... }

// After (signal)
if (!this.policyFormRef()) { ... }
```

Output signals emit differently:

```typescript
// Before
this.onEditFolder.emit(folder);

// After
this.onEditFolder.emit(folder); // same — output() keeps .emit()
```

---

## Step 2: Cleanup checklist per resolved FIXME

For every fixed instance:

- [ ] FIXME comment line removed
- [ ] `eslint-disable-next-line` line removed
- [ ] Decorator imports removed if unused
- [ ] Signal/strategy imports added if not already present
- [ ] All usages of the converted property updated (add `()` for signal reads)

---

## Step 3: Validate

```bash
npm run lint:fix
npm run test
```

Fix any errors before finishing.

---

## Key rules

- Always remove **both** the FIXME line and the `eslint-disable-next-line` line — never leave one without the other.
- Prefer CLI schematics over manual migration for CL-903 (handles edge cases and tests).
- For CL-764, OnPush is safe to add after ensuring no `Default`-only patterns exist (e.g. relying on implicit re-renders from mutable inputs).
- Refer to the `angular-modernization` skill for broader Bitwarden patterns (signals vs observables, visibility modifiers, etc.).
