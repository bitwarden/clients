---
paths:
  - "**/*.component.ts"
  - "**/*.component.html"
---

# Angular Component Patterns

Distilled from [Web Code Style](https://contributing.bitwarden.com/contributing/code-style/web/). Angular patterns that span beyond components (DI) live in [angular.md](./angular.md); TypeScript-wide rules (enum-likes, file/class naming) live in [typescript.md](./typescript.md); Tailwind rules live in [tailwind.md](./tailwind.md).

## Component Configuration

- **Standalone**: Components must be standalone. NgModules may still be used to group components, but the inner components must be standalone. Declare imports on the component decorator; do not register in `NgModule.declarations`.
- **OnPush**: Set `changeDetection: ChangeDetectionStrategy.OnPush`. With OnPush, mutating arrays/objects in place does **not** trigger change detection — create new references (`[...arr]`, `{...obj}`) or use signals.
- **Host bindings**: Use the `host` property — not `@HostBinding` / `@HostListener`.

```typescript
@Component({
  selector: "app-example",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  host: {
    "[class.active]": "isActive()",
    "(click)": "onClick()",
  },
})
```

## Signals (ADR-0027)

Signals are the default for component-local state and template I/O:

- `input()` / `input.required()` — replaces `@Input()`
- `output()` — replaces `@Output()`
- `viewChild()` / `viewChildren()` — replace `@ViewChild` / `@ViewChildren`
- `computed()` for derived state — preferred over functions called from the template (re-runs only when dependencies change)

```typescript
name = input<string>("");
id = input.required<string>();
save = output<string>();
inputEl = viewChild<ElementRef>("input");

displayName = computed(() => `${this.firstName()} ${this.lastName()}`);
```

### RxJS Interop

Use `toSignal()` to consume Observables in templates, `toObservable()` to expose signals as streams.

```typescript
import { toSignal, toObservable } from "@angular/core/rxjs-interop";

protected folders = toSignal(this.folderService.folderViews$, { initialValue: [] });
```

## Subscribing to Observables (ADR-0003)

Prefer the `async` pipe over `.subscribe()`:

```typescript
protected folders$ = this.folderService.folders$;
```

```html
@for (folder of folders$ | async; track folder.id) {
<li>{{ folder.name }}</li>
}
```

For explicit subscriptions, pipe through `takeUntilDestroyed()`:

```typescript
constructor() {
  this.observable$.pipe(takeUntilDestroyed()).subscribe(...);
}

// Outside an injector context:
constructor(private destroyRef: DestroyRef) {}
ngOnInit() {
  this.observable$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(...);
}
```

Do not nest `.subscribe()` calls. Compose with `switchMap` (cancel previous), `concatMap` (sequential, order-preserving), or `mergeMap` (parallel — use sparingly).

## Templates

### Control Flow

Use built-in `@if` / `@for` / `@switch` — not `*ngIf` / `*ngFor` / `*ngSwitch`.

```html
@if (isVisible()) {
<div>Content</div>
} @for (item of items(); track item.id) {
<div>{{ item.name }}</div>
}
```

### Class & Style Bindings

Prefer native `[class.x]` / `[style.x]` over `ngClass` / `ngStyle`. For many classes/styles, compose with `computed()`.

```html
<div [class.active]="isActive()" [style.width.px]="width()"></div>
```

### IDs for Inputs and Buttons

Every input field and button needs a descriptive ID for QA automation:

`<component_name>_<html_element>_<readable_name>` — underscores between components, dashes within.

```html
<input id="register-form_input_email" /> <button id="register_button_submit">Submit</button>
```

Component-library components may emit auto-generated IDs (`<component-selector>-<n>`, e.g. `bit-input-0`) but must allow overrides. Selectors use dashes, not camelCase.

### Reactive Forms

Use Reactive forms — not Template-Driven. The Bitwarden Component Library is built around Reactive forms.

## Class Conventions

- **Thin components**: View logic only. Move business logic into services.
- **Composition over inheritance**: Break large components into standalone pieces. Different clients customize at the page level and share child components rather than extending a base.
- `protected` for members touched only by the template; `readonly` for component-level constants.

## Enum-Like Inputs

Expose the enum-like from the component so templates can reference members by name. Prefer string-backed values for inputs.

```typescript
const DialogType = { Confirm: "confirm", Alert: "alert" } as const;
type DialogType = (typeof DialogType)[keyof typeof DialogType];

// Numeric variants need to be exposed for template binding:
protected readonly PermissionLevel = PermissionLevel;
```

```html
<my-component type="alert" /> <my-component [level]="PermissionLevel.Admin" />
```

## Migration

When modernizing legacy components (NgModule → standalone, `*ngIf` → `@if`, `@Input()` → `input()`, etc.), use the `angular-modernization` skill — it sequences migrations safely (signals must land before OnPush, etc.).
