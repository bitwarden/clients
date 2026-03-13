# Angular Standards

**Purpose:** Standards for Angular-specific state management patterns, including Observable vs Signal usage, mutation patterns, and smart model implementation in Access Intelligence development

---

## Angular State Management

### Observable vs Signal (ADR-0027 Compliance)

**Service Layer (Platform-Agnostic):**

- **Always use RxJS Observables** for domain services
- Services expose state as `Observable<T>` (BehaviorSubject internally)
- Ensures compatibility with web, desktop, browser, and CLI

**Component Layer (Angular-Specific):**

- **Preferred**: Convert Observable to Signal using `toSignal()`
- **Acceptable**: Use `async` pipe in templates
- **Avoid**: Manual subscriptions unless absolutely necessary

**Example:**

```typescript
// Service (platform-agnostic)
export class DefaultAccessIntelligenceDataService {
  private _report = new BehaviorSubject<RiskInsightsView | null>(null);
  readonly report$ = this._report.asObservable();
}

// Component (Angular-specific, uses OnPush)
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
export class RiskInsightsComponent {
  protected report = toSignal(this.dataService.report$, { initialValue: null });

  // Template: {{ report()?.summary.totalApplicationCount }}
}
```

### Mutation vs Immutability

**View Models are Mutable** (following CipherView pattern):

- `RiskInsightsView`, `CipherView`, `FolderView` are all mutable
- Update methods mutate in place and call `recomputeSummary()` or similar
- Memory-efficient for large objects (10-15 MB reports)
- Avoids expensive deep clones

**Service emits after mutation to trigger subscribers:**

```typescript
// ✅ CORRECT - Mutation + emit
const view = this._report.value;
view.markApplicationAsCritical("github.com"); // Mutate in place
this._report.next(view); // Emit same reference

// ❌ WRONG - Creating new instance
const newView = structuredClone(view); // 10-15 MB allocation!
newView.markApplicationAsCritical("github.com");
this._report.next(newView);
```

**Why mutation + Observable works with OnPush:**

- `async` pipe calls `ChangeDetectorRef.markForCheck()` on ANY emission
- Signal updates trigger automatic change detection
- Reference equality doesn't matter - emission itself triggers update

### Smart Models (CipherView Pattern)

**View models should have business logic methods** - don't be "dumb data bags".

**RiskInsightsView follows this pattern:**

```typescript
export class RiskInsightsView {
  // Query Methods (read-only)
  getAtRiskMembers(): MemberRegistryEntry[];
  getCriticalApplications(): RiskInsightsReportView[];
  getNewApplications(): RiskInsightsReportView[];
  getApplicationByName(name: string): RiskInsightsReportView | undefined;
  getTotalMemberCount(): number;

  // Update Methods (mutate + recompute)
  markApplicationAsCritical(appName: string): void;
  unmarkApplicationAsCritical(appName: string): void;
  markApplicationAsReviewed(appName: string, date?: Date): void;

  // Computation Methods
  recomputeSummary(): void;
}
```

**Why:**

- Business logic lives on the model, not scattered across services
- Updating critical apps doesn't require full report regeneration
- Clean, intuitive API: `view.markApplicationAsCritical(name)`
- Easy to unit test

---

## Method Declarations vs Arrow Function Class Fields

**Prefer method declarations** (prototype methods) for component methods and event handlers.
Use arrow function class fields **only** when a function reference must be passed as a value.

### When to Use Each

**Method declarations** (default choice):

```typescript
// ✅ CORRECT - standard event handlers, business logic methods
markAppsAsCritical(): void { ... }
onTabChange(index: number): void { ... }
downloadCSV(): void { ... }
```

**Arrow function class fields** (only when passing function as value reference):

```typescript
// ✅ CORRECT - function passed as @Input() value
showAppAtRiskMembers = (applicationName: string) => {
  this.drawerStateService.openDrawer(DrawerType.AppAtRiskMembers, applicationName);
};

// Template usage: [showAppAtRiskMembers]="showAppAtRiskMembers"
```

**Why the distinction matters:**

- Method declarations live on the prototype — one instance shared across all component instances
- Arrow function class fields create a new function per component instance (unnecessary memory cost)
- Arrow functions as inputs ensure stable `this` binding when the function reference is passed around

### Summary Table

| Scenario                                               | Pattern                    |
| ------------------------------------------------------ | -------------------------- |
| Regular event handler in template `(click)="method()"` | Method declaration         |
| Business logic / lifecycle hooks                       | Method declaration         |
| Passed as `[input]="fn"` template binding              | Arrow function class field |
| Passed to child component input expecting a callback   | Arrow function class field |

---

## RxJS Over async/await in Components

**Prefer pure RxJS pipelines over async/await**, even within Angular components.

This aligns with the team's service-layer RxJS conventions and avoids mixing async paradigms.

### Patterns

**Parallel operations — use `forkJoin` instead of `Promise.all`:**

```typescript
// ✅ CORRECT
markAppsAsCritical(): void {
  forkJoin(appNames.map((name) => this.service.markApplicationAsCritical$(name)))
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.updatingApps.set(false)),
    )
    .subscribe({ next: () => { ... }, error: () => { ... } });
}

// ❌ AVOID
async markAppsAsCritical(): Promise<void> {
  await Promise.all(appNames.map((name) => lastValueFrom(this.service.markApplicationAsCritical$(name))));
}
```

**Sequential reactive pipelines — use `switchMap` instead of `await`:**

```typescript
// ✅ CORRECT
ngOnInit(): void {
  this.route.paramMap.pipe(
    map((params) => params.get("organizationId")),
    filter(Boolean),
    switchMap((orgId) => this.service.initializeForOrganization$(orgId as OrganizationId)),
    takeUntilDestroyed(this.destroyRef),
  ).subscribe();
}
```

### `takeUntilDestroyed` is required by ESLint

All subscriptions must include `takeUntilDestroyed`, even for one-shot operations like `forkJoin`.
When called from a **method** (outside injection context), you **must** pass `destroyRef` explicitly:

```typescript
// ✅ CORRECT - explicit destroyRef in method context
private destroyRef = inject(DestroyRef);

someMethod(): void {
  forkJoin([...]).pipe(
    takeUntilDestroyed(this.destroyRef),  // explicit - required outside injection context
  ).subscribe();
}

// ✅ ALSO CORRECT - in constructor (injection context), no argument needed
constructor() {
  this.obs$.pipe(takeUntilDestroyed()).subscribe();
}
```

---

## Related Documentation

**Standards:**

- [Model Standards](./model-standards.md) - Smart models and view construction patterns
- [RxJS Standards](./rxjs-standards.md) - Observable patterns for services
- [Service Standards](./service-standards.md) - Service patterns and state management
- [Testing Standards - Components](./testing-standards-components.md) - Testing OnPush components with Signals

**Navigation:**

- [Standards Hub](./README.md) - All DIRT team standards

---

**Document Version:** 1.1
**Last Updated:** 2026-02-25
**Maintainer:** DIRT Team
