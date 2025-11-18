# Angular Migration Patterns Reference

## Table of Contents

- [Component Architecture](#component-architecture)
- [Dependency Injection](#dependency-injection)
- [Reactivity Patterns](#reactivity-patterns)
- [Template Syntax](#template-syntax)
- [Type Safety](#type-safety)

## Component Architecture

### Standalone Components

```typescript
@Component({
  selector: "app-user-profile",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AsyncPipe],
  templateUrl: "./user-profile.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent {}
```

### Class Member Organization

```typescript
@Component({...})
export class MyComponent {
  // 1. Inputs (public)
  @Input() data: string;

  // 2. Outputs (public)
  @Output() valueChange = new EventEmitter<string>();

  // 3. ViewChild/ContentChild
  @ViewChild('template') template: TemplateRef<any>;

  // 4. Injected dependencies (private/protected)
  private userService = inject(UserService);
  protected dialogService = inject(DialogService);

  // 5. Public properties
  public formGroup: FormGroup;

  // 6. Protected properties (template-accessible)
  protected isLoading = signal(false);
  protected items$ = this.itemService.items$;

  // 7. Private properties
  private cache = new Map();

  // 8. Lifecycle hooks
  ngOnInit() {}

  // 9. Public methods
  public save() {}

  // 10. Protected methods (template-accessible)
  protected handleClick() {}

  // 11. Private methods
  private processData() {}
}
```

## Dependency Injection

### Modern inject() Function

**Before:**

```typescript
constructor(
  private userService: UserService,
  private route: ActivatedRoute
) {}
```

**After:**

```typescript
private userService = inject(UserService);
private route = inject(ActivatedRoute);
```

## Reactivity Patterns

### Signals for Component State (ADR-0027)

```typescript
// Local state
protected selectedFolder = signal<Folder | null>(null);
protected isLoading = signal(false);

// Derived state
protected hasSelection = computed(() => this.selectedFolder() !== null);
```

### Prefer computed() Over effect()

Use `computed()` for derived values. Use `effect()` only for side effects (logging, analytics, DOM sync).

**❌ Bad:**

```typescript
constructor() {
  effect(() => {
    const id = this.selectedId();
    this.selectedItem.set(this.items().find(i => i.id === id) ?? null);
  });
}
```

**✅ Good:**

```typescript
selectedItem = computed(() => this.items().find((i) => i.id === this.selectedId()) ?? null);
```

### Observables for Service Communication (ADR-0003)

```typescript
// In component
protected folders$ = this.folderService.folders$;

// Template
// <div *ngFor="let folder of folders$ | async">

// For explicit subscriptions
constructor() {
  this.userService.user$
    .pipe(takeUntilDestroyed())
    .subscribe(user => this.handleUser(user));
}
```

### Bridging Observables to Signals

Use `toSignal()` to convert service observables to signals in components. Keep service state as observables (ADR-0003).

**Before:**

```typescript
private destroy$ = new Subject<void>();
users: User[] = [];

ngOnInit() {
  this.userService.users$.pipe(takeUntil(this.destroy$))
    .subscribe(users => this.users = users);
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}
```

**After:**

```typescript
protected users = toSignal(this.userService.users$, { initialValue: [] });
```

## Template Syntax

### New Control Flow

**Before:**

```html
<div *ngIf="user$ | async as user; else loading">
  <p *ngFor="let item of user.items">{{ item.name }}</p>
</div>
<ng-template #loading>Loading...</ng-template>
```

**After:**

```html
@if (user$ | async; as user) { @for (item of user.items; track item.id) {
<p>{{ item.name }}</p>
} } @else {
<p>Loading...</p>
}
```

### Prefer Class/Style Bindings Over ngClass/ngStyle

Use `[class.*]` and `[style.*]` bindings instead of `ngClass`/`ngStyle`.

**❌ Bad:**

```html
<div [ngClass]="{ 'active': isActive(), 'disabled': isDisabled() }">
  <div [ngStyle]="{ 'width.px': width(), 'height.px': height() }"></div>
</div>
```

**✅ Good:**

```html
<div [class.active]="isActive()" [class.disabled]="isDisabled()">
  <div [style.width.px]="width()" [style.height.px]="height()"></div>
</div>
```

## Type Safety

### No TypeScript Enums (ADR-0025)

**Before:**

```typescript
enum CipherType {
  Login = 1,
  SecureNote = 2,
}
```

**After:**

```typescript
export const CipherType = Object.freeze({
  Login: 1,
  SecureNote: 2,
} as const);
export type CipherType = (typeof CipherType)[keyof typeof CipherType];
```

### Reactive Forms

```typescript
protected formGroup = new FormGroup({
  name: new FormControl('', { nonNullable: true }),
  email: new FormControl<string>('', { validators: [Validators.email] }),
});
```

## Anti-Patterns to Avoid

- ❌ Manually refactoring when CLI migrations exist
- ❌ Manual subscriptions without `takeUntilDestroyed()`
- ❌ TypeScript enums (use const objects per ADR-0025)
- ❌ Mixing constructor injection with `inject()`
- ❌ Signals in services shared with non-Angular code (ADR-0003)
- ❌ Business logic in components
- ❌ Code regions
- ❌ Converting service observables to signals (ADR-0003)
- ❌ Using `effect()` for derived state (use `computed()`)
- ❌ Using `ngClass`/`ngStyle` (use `[class.*]`/`[style.*]`)
