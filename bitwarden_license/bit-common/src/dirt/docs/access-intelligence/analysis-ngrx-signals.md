# NgRx Signals Analysis for Access Intelligence

**Purpose:** Analysis of NgRx Signal Store/State vs Observable pattern for Access Intelligence state management

---

## Executive Summary

**Recommendation: NO - Continue with current Observable + Signal pattern**

The current architecture (Observable-based services + component-level Signals via `toSignal()`) is the right choice for Access Intelligence. NgRx Signal Store would add unnecessary complexity without meaningful benefits for this use case.

**Exception: Report generation progress tracking should use a Signal-based pattern (see [Report Progress Tracking](#report-progress-tracking-recommendation) below).**

---

## Current Architecture Analysis

### ✅ What We Have (V2)

```typescript
// Service Layer (Platform-Agnostic)
export class DefaultAccessIntelligenceDataService {
  private _report = new BehaviorSubject<RiskInsightsView | null>(null);
  readonly report$ = this._report.asObservable();

  private _loading = new BehaviorSubject<boolean>(false);
  readonly loading$ = this._loading.asObservable();
}

// Component Layer (Angular-Specific)
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
export class RiskInsightsV2Component {
  protected report = toSignal(this.dataService.report$);
  protected loading = toSignal(this.dataService.loading$);

  // Template: {{ report()?.summary.totalApplicationCount }}
}

// Presentational Service (UI State Only)
export class DefaultDrawerStateService {
  private _drawerState = signal<DrawerState>(defaultState);
  drawerState = this._drawerState.asReadonly();

  openDrawer(type: DrawerType, invokerId: string): void {
    this._drawerState.set({ open: true, type, invokerId });
  }
}
```

**Key Characteristics:**

- Domain services use Observables (RxJS) for cross-platform compatibility
- Components convert to Signals at the boundary using `toSignal()`
- Presentational services (DrawerStateService) use Signals natively
- Smart models (RiskInsightsView) contain business logic
- Single source of truth: one BehaviorSubject for report state

---

## NgRx Signals Options

### Option 1: Signal State

**What it is:** Extension of Angular Signals for managing complex/nested state objects.

```typescript
// Example with Signal State
import { signalState, patchState } from "@ngrx/signals";

export class AccessIntelligenceDataService {
  state = signalState<{
    report: RiskInsightsView | null;
    loading: boolean;
    error: string | null;
  }>({
    report: null,
    loading: false,
    error: null,
  });

  markApplicationAsCritical(appName: string): void {
    const current = this.state.report();
    current?.markApplicationAsCritical(appName);
    patchState(this.state, { report: current });
  }
}
```

**Pros:**

- Slightly less boilerplate than BehaviorSubject pattern
- Built-in reactivity with Signals
- Good for component-scoped state

**Cons:**

- ❌ Angular-only (not compatible with desktop, browser, CLI)
- ❌ Loses RxJS operators (no `switchMap`, `combineLatest`, etc.)
- ❌ Breaking change from established Bitwarden patterns
- ❌ Would require retraining team on new API

### Option 2: Signal Store

**What it is:** Centralized, extensible state management with business logic built in.

```typescript
// Example with Signal Store
import { signalStore, withState, withMethods } from '@ngrx/signals';

export const AccessIntelligenceStore = signalStore(
  { providedIn: 'root' },
  withState<{
    report: RiskInsightsView | null;
    loading: boolean;
    error: string | null;
  }>({
    report: null,
    loading: false,
    error: null,
  }),
  withMethods((store, generationService = inject(ReportGenerationService)) => ({
    async generateReport(orgId: OrganizationId): Promise<void> {
      patchState(store, { loading: true });
      try {
        const report = await firstValueFrom(generationService.generateReport$(...));
        patchState(store, { report, loading: false });
      } catch (error) {
        patchState(store, { error: error.message, loading: false });
      }
    },
    markApplicationAsCritical(appName: string): void {
      const current = store.report();
      current?.markApplicationAsCritical(appName);
      patchState(store, { report: current });
    },
  }))
);
```

**Pros:**

- Centralized state management
- Built-in dev tools integration
- Reduces boilerplate in some cases
- Good for large apps with complex shared state

**Cons:**

- ❌ **Unnecessary complexity for this use case** (single service, single state object)
- ❌ Angular-only (not compatible with desktop, browser, CLI)
- ❌ Replaces services rather than complementing them
- ❌ Team concerns about architectural shift (per your note)
- ❌ Adds dependency on @ngrx/signals package
- ❌ Learning curve for developers unfamiliar with NgRx patterns

---

## Decision Matrix

| Factor                             | Current (Observable + toSignal)     | Signal State                | Signal Store                 |
| ---------------------------------- | ----------------------------------- | --------------------------- | ---------------------------- |
| **Cross-platform compatibility**   | ✅ Yes (web, desktop, browser, CLI) | ❌ No (Angular only)        | ❌ No (Angular only)         |
| **Aligns with Bitwarden ADR-0027** | ✅ Yes (Observables in services)    | ❌ No (Signals in services) | ❌ No (Signals in services)  |
| **RxJS operators support**         | ✅ Full support                     | ⚠️ Limited (must convert)   | ⚠️ Limited (must convert)    |
| **Team familiarity**               | ✅ Established pattern              | ⚠️ New API                  | ⚠️ New API + concepts        |
| **Complexity**                     | ✅ Low (standard pattern)           | ⚠️ Medium (new abstraction) | ❌ High (store paradigm)     |
| **Boilerplate**                    | ⚠️ Moderate                         | ✅ Low                      | ✅ Low                       |
| **Dev tools**                      | ⚠️ Basic (RxJS dev tools)           | ⚠️ Basic                    | ✅ Excellent (NgRx DevTools) |
| **適合 this use case**             | ✅ Perfect fit                      | ⚠️ Overkill                 | ❌ Overkill                  |

---

## Why Current Pattern is Better

### 1. Aligns with Bitwarden Architecture Decision Records

**ADR-0027: Observable Data Services**

> "Services expose RxJS Observable streams for state management. Use Signals **only** in Angular components and presentational services."

**Current V2 implementation follows this exactly:**

- ✅ `AccessIntelligenceDataService` uses Observables (platform-agnostic)
- ✅ `DrawerStateService` uses Signals (presentational, Angular-only)
- ✅ Components convert with `toSignal()`

**Switching to Signal State/Store would violate ADR-0027.**

### 2. Cross-Platform Requirement

Bitwarden clients repo supports:

- Web (Angular)
- Desktop (Electron + Angular)
- Browser Extension (Angular + background workers)
- CLI (Node.js, no Angular)

**Observable-based services work everywhere. Signal-based services only work in Angular.**

From CLAUDE.md:

> "Platform-agnostic domain service used by AccessIntelligenceDataService."

### 3. RxJS Operators Are Essential

Report generation pipeline uses complex RxJS composition:

```typescript
// Current V2 pattern - needs RxJS operators
generateNewReport$(orgId: OrganizationId): Observable<void> {
  return forkJoin({
    ciphers: from(this.cipherService.getAllFromApiForOrganization(orgId)),
    members: from(this.organizationService.getOrganizationUsers(orgId)),
    collections: from(this.collectionService.getAllForOrganization(orgId)),
    groups: from(this.groupService.getAll(orgId)),
  }).pipe(
    switchMap(data => this.reportGenerationService.generateReport$(
      data.ciphers,
      data.members,
      this.transformCollectionAccess(data.collections),
      this.transformGroupMemberships(data.groups),
    )),
    switchMap(view => this.reportPersistenceService.save$(view)),
    tap(savedView => this._report.next(savedView)),
    map(() => void 0),
    catchError(error => {
      this._error.next(error.message);
      return throwError(() => error);
    })
  );
}
```

**With Signal Store, you'd lose:**

- `forkJoin` (parallel data loading)
- `switchMap` (chaining async operations)
- `tap` (side effects)
- `catchError` (error handling)

You'd have to convert to Promises everywhere, losing composability.

### 4. Single Source of Truth Already Achieved

NgRx Signal Store's main value proposition is **centralized state management**.

**We already have this:**

- One `BehaviorSubject<RiskInsightsView | null>` holds report
- One `report$` observable for all subscribers
- Smart model methods (`report.markApplicationAsCritical()`) handle logic
- Service just orchestrates: `model.mutate()` → `persist()`

**Adding Signal Store wouldn't improve centralization - it would just change the API.**

### 5. Team Concerns About Architectural Shift

From your question:

> "Some other devs were worried about this... would it actually be a replacement?"

**Yes, it would be a replacement, not a complement:**

- Signal Store replaces service-based state management
- Requires different mental model (store + reducers vs services + observables)
- Different testing patterns
- Different debugging patterns

**This is a significant architectural shift for questionable benefit.**

### 6. Size/Complexity Guidelines Don't Apply

From [Nx Angular State Management 2025 blog](https://nx.dev/blog/angular-state-management-2025):

> "When you have a simple to mid-size project and you have up to 4–5 developers on a project, you can be safe with signal state or pure signals."

**Access Intelligence is mid-complexity, but:**

- Only **one** main state object (RiskInsightsView)
- Only **one** service managing it (AccessIntelligenceDataService)
- Clear boundaries (data service → domain services → persistence)
- Not a large-scale app with dozens of interconnected stores

**This use case doesn't need NgRx's "structured approach to managing things."**

---

## Report Progress Tracking Recommendation

### ⚠️ Missing in Current V2 Abstract

The `ReportGenerationService` abstract does NOT expose progress tracking:

```typescript
// Current abstract - no progress Observable
abstract generateReport(
  ciphers: CipherView[],
  members: OrganizationUserView[],
  collectionAccess: CollectionAccessDetails[],
  groupMemberships: GroupMembershipDetails[],
  previousApplications?: RiskInsightsApplicationView[],
): Observable<RiskInsightsView>;
```

### V1 Had Progress Tracking

```typescript
// Old component (V1) subscribed to reportProgress$
this.dataService.reportProgress$
  .pipe(
    skip(1),
    concatMap((step) => {
      if (step === null || step === ReportProgress.FetchingMembers) {
        return of(step);
      }
      return concat(of(step), of(step).pipe(delay(this.STEP_DISPLAY_DELAY_MS)));
    }),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe((step) => {
    this.currentProgressStep.set(step);
  });
```

**V1 progress steps:**

```typescript
export const ReportProgress = Object.freeze({
  FetchingMembers: 0,
  FetchingCiphers: 1,
  CheckingHealth: 2,
  MappingMembers: 3,
  Aggregating: 4,
  Encrypting: 5,
  Saving: 6,
  Complete: 7,
} as const);
```

### ✅ Recommended Pattern: Signal-Based Progress

**1. Add progress to AccessIntelligenceDataService (not ReportGenerationService)**

```typescript
// abstractions/access-intelligence-data.service.ts
export abstract class AccessIntelligenceDataService {
  abstract readonly report$: Observable<RiskInsightsView | null>;
  abstract readonly loading$: Observable<boolean>;
  abstract readonly error$: Observable<string | null>;

  /**
   * Current report generation progress step.
   *
   * Emits progress updates during report generation to show detailed loading state.
   * Null when no generation is in progress.
   *
   * Components can use this for step-by-step progress indicators.
   */
  abstract readonly reportProgress: Signal<ReportProgress | null>;

  abstract generateNewReport$(orgId: OrganizationId): Observable<void>;
}
```

**2. Use Signal (not Observable) for progress**

**Why Signal instead of Observable:**

- ✅ Progress is **UI-only state** (doesn't need RxJS operators)
- ✅ Always has a current value (perfect for Signals)
- ✅ Simple read access (`progress()` vs `progress$ | async`)
- ✅ Follows Angular's direction (Signals for simple reactive values)
- ✅ DrawerStateService already uses this pattern successfully

**Why NOT Observable:**

- ❌ No need for `switchMap`, `map`, etc. (just `.set()` updates)
- ❌ Adds boilerplate (`BehaviorSubject` + `asObservable()`)
- ❌ Components would still convert to Signal with `toSignal()`

**3. Implementation in DefaultAccessIntelligenceDataService**

```typescript
// implementations/default-access-intelligence-data.service.ts
export class DefaultAccessIntelligenceDataService implements AccessIntelligenceDataService {
  private _report = new BehaviorSubject<RiskInsightsView | null>(null);
  readonly report$ = this._report.asObservable();

  private _loading = new BehaviorSubject<boolean>(false);
  readonly loading$ = this._loading.asObservable();

  private _error = new BehaviorSubject<string | null>(null);
  readonly error$ = this._error.asObservable();

  // ✅ NEW: Signal for progress tracking
  private _reportProgress = signal<ReportProgress | null>(null);
  readonly reportProgress = this._reportProgress.asReadonly();

  generateNewReport$(orgId: OrganizationId): Observable<void> {
    return of(null).pipe(
      // Set initial progress
      tap(() => {
        this._loading.next(true);
        this._reportProgress.set(ReportProgress.FetchingMembers);
      }),

      // Load organization data
      switchMap(() =>
        forkJoin({
          members: from(this.organizationService.getOrganizationUsers(orgId)).pipe(
            tap(() => this._reportProgress.set(ReportProgress.FetchingCiphers)),
          ),
          ciphers: from(this.cipherService.getAllFromApiForOrganization(orgId)).pipe(
            tap(() => this._reportProgress.set(ReportProgress.FetchingCollections)),
          ),
          collections: from(this.collectionService.getAllForOrganization(orgId)).pipe(
            tap(() => this._reportProgress.set(ReportProgress.FetchingGroups)),
          ),
          groups: from(this.groupService.getAll(orgId)),
        }),
      ),

      // Transform and generate
      tap(() => this._reportProgress.set(ReportProgress.GeneratingReport)),
      switchMap((data) =>
        this.reportGenerationService.generateReport$(
          data.ciphers,
          data.members,
          this.transformCollectionAccess(data.collections),
          this.transformGroupMemberships(data.groups),
          this._report.value?.applications,
        ),
      ),

      // Persist
      tap(() => this._reportProgress.set(ReportProgress.SavingReport)),
      switchMap((view) => this.reportPersistenceService.save$(view)),

      // Update state
      tap((savedView) => {
        this._report.next(savedView);
        this._reportProgress.set(ReportProgress.Complete);
        this._loading.next(false);
        // Reset progress after short delay so UI can show "Complete"
        setTimeout(() => this._reportProgress.set(null), 1000);
      }),

      // Error handling
      catchError((error) => {
        this._error.next(error.message);
        this._loading.next(false);
        this._reportProgress.set(null);
        return throwError(() => error);
      }),

      map(() => void 0),
    );
  }
}
```

**4. Progress enum**

```typescript
// models/report-progress.ts
export const ReportProgress = Object.freeze({
  FetchingMembers: "fetchingMembers",
  FetchingCiphers: "fetchingCiphers",
  FetchingCollections: "fetchingCollections",
  FetchingGroups: "fetchingGroups",
  GeneratingReport: "generatingReport",
  SavingReport: "savingReport",
  Complete: "complete",
} as const);
export type ReportProgress = (typeof ReportProgress)[keyof typeof ReportProgress];
```

**5. Component usage**

```typescript
// v2/risk-insights-v2.component.ts
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
export class RiskInsightsV2Component {
  // Convert observables to signals
  protected report = toSignal(this.dataService.report$);
  protected loading = toSignal(this.dataService.loading$);

  // ✅ NEW: Use progress signal directly (no conversion needed)
  protected reportProgress = this.dataService.reportProgress;

  // Computed for step display
  protected currentProgressMessage = computed(() => {
    const step = this.reportProgress();
    if (!step) return null;

    const messages = {
      [ReportProgress.FetchingMembers]: this.i18n.t("fetchingMembers"),
      [ReportProgress.FetchingCiphers]: this.i18n.t("fetchingCiphers"),
      [ReportProgress.GeneratingReport]: this.i18n.t("generatingReport"),
      [ReportProgress.SavingReport]: this.i18n.t("savingReport"),
      [ReportProgress.Complete]: this.i18n.t("complete"),
    };

    return messages[step] ?? null;
  });

  protected showProgressIndicator = computed(() => {
    return this.loading() && this.reportProgress() !== null;
  });
}
```

**6. Template usage**

```html
<!-- v2/risk-insights-v2.component.html -->
<app-report-loading
  *ngIf="showProgressIndicator()"
  [message]="currentProgressMessage()"
  [step]="reportProgress()"
/>
```

### Why This Pattern is Better Than V1

**V1 used Observable + manual delay logic:**

```typescript
// V1 - complex concatMap chain to show each step for minimum time
this.dataService.reportProgress$
  .pipe(
    skip(1),
    concatMap((step) => {
      if (step === null || step === ReportProgress.FetchingMembers) {
        return of(step);
      }
      return concat(of(step), of(step).pipe(delay(250)));
    }),
    takeUntilDestroyed(),
  )
  .subscribe((step) => {
    this.currentProgressStep.set(step);
  });
```

**V2 uses Signal + setTimeout:**

```typescript
// V2 - simpler, clearer
tap(() => this._reportProgress.set(ReportProgress.Complete)),
tap(() => setTimeout(() => this._reportProgress.set(null), 1000)),
```

**Benefits:**

- ✅ Clearer intent (delay before reset, not artificial display time)
- ✅ No complex RxJS operators for UI timing
- ✅ Signal reactivity handles updates automatically
- ✅ No `skip(1)` hack needed (Signal doesn't emit on subscription)
- ✅ Easier to test (just check signal value, not Observable emissions)

---

## When WOULD NgRx Signals Make Sense?

If Access Intelligence had these characteristics, Signal Store might be justified:

1. **Multiple interconnected state slices**
   - Example: Reports state, Users state, Permissions state, Settings state
   - Reality: We have ONE state object (RiskInsightsView)

2. **Complex state updates requiring coordination**
   - Example: Optimistic updates, undo/redo, state history
   - Reality: Simple mutations via view model methods

3. **State shared across many unrelated feature modules**
   - Example: Global app state accessed by 10+ modules
   - Reality: State is scoped to Access Intelligence feature only

4. **Need for advanced dev tools and time-travel debugging**
   - Example: Complex workflows with hard-to-reproduce bugs
   - Reality: Straightforward data loading + display

5. **Angular-only codebase**
   - Example: Web-only app, no desktop/CLI clients
   - Reality: Multi-platform Bitwarden clients

**Access Intelligence has NONE of these characteristics.**

---

## Recommendations

### ✅ DO

1. **Continue with current Observable + Signal pattern**
   - Services use Observables (platform-agnostic)
   - Components convert with `toSignal()` (Angular-specific)
   - Presentational services use Signals (DrawerStateService pattern)

2. **Add progress tracking using Signal pattern**
   - Add `reportProgress: Signal<ReportProgress | null>` to AccessIntelligenceDataService
   - Update progress in `generateNewReport$()` Observable pipeline
   - Components read directly without conversion

3. **Document this decision**
   - Add to architecture docs
   - Reference ADR-0027 compliance
   - Explain why NgRx Signals weren't used (for future maintainers)

4. **Consider Signals for future presentational state**
   - Filter state in tables
   - Sort direction
   - Pagination
   - Tab selection
   - Anything that's UI-only and doesn't need RxJS operators

### ❌ DON'T

1. **Don't use Signal State/Store for domain services**
   - Violates ADR-0027
   - Breaks cross-platform compatibility
   - Adds complexity without benefit

2. **Don't mix Signal State with Observable services**
   - Creates confusion about which pattern to use
   - Forces unnecessary conversions
   - Makes codebase inconsistent

3. **Don't replace existing Observable patterns**
   - RxJS operators are essential for data pipelines
   - Team is familiar with current approach
   - No migration benefit

4. **Don't add @ngrx/signals dependency**
   - Not needed for this use case
   - Adds bundle size
   - Increases maintenance burden

---

## Appendix: Code Examples

### Current V2 Pattern (Recommended)

```typescript
// ✅ Service: Observable-based (platform-agnostic)
export class DefaultAccessIntelligenceDataService {
  private _report = new BehaviorSubject<RiskInsightsView | null>(null);
  readonly report$ = this._report.asObservable();

  private _reportProgress = signal<ReportProgress | null>(null);
  readonly reportProgress = this._reportProgress.asReadonly();

  generateNewReport$(orgId: OrganizationId): Observable<void> {
    return forkJoin({ ... }).pipe(
      tap(() => this._reportProgress.set(ReportProgress.FetchingCiphers)),
      switchMap(...),
      tap(view => this._report.next(view)),
    );
  }
}

// ✅ Component: Convert to Signals at boundary
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
export class RiskInsightsV2Component {
  protected report = toSignal(this.dataService.report$);
  protected reportProgress = this.dataService.reportProgress;

  protected hasData = computed(() => this.report()?.reports.length > 0);
}
```

### Alternative: Signal Store (NOT Recommended)

```typescript
// ❌ Would require: import { signalStore, withState, withMethods } from '@ngrx/signals';

export const AccessIntelligenceStore = signalStore(
  { providedIn: 'root' },
  withState({
    report: null as RiskInsightsView | null,
    loading: false,
    progress: null as ReportProgress | null,
  }),
  withMethods((store, genService = inject(ReportGenerationService)) => ({
    async generateReport(orgId: OrganizationId): Promise<void> {
      patchState(store, { loading: true, progress: ReportProgress.FetchingCiphers });

      // ❌ Lost RxJS composition - must use Promises
      const members = await firstValueFrom(this.orgService.getUsers$(orgId));
      patchState(store, { progress: ReportProgress.FetchingCiphers });

      const ciphers = await firstValueFrom(this.cipherService.getCiphers$(orgId));
      patchState(store, { progress: ReportProgress.GeneratingReport });

      // ❌ Can't use forkJoin for parallel loading
      // ❌ Can't use switchMap for cancellation
      // ❌ Error handling is more verbose

      const report = await firstValueFrom(genService.generateReport$(...));
      patchState(store, { report, loading: false, progress: null });
    },
  })),
);

// ❌ Component must use store instead of service
@Component({ ... })
export class RiskInsightsV2Component {
  protected store = inject(AccessIntelligenceStore);

  // ✅ Simpler property access
  protected report = this.store.report;
  protected loading = this.store.loading;

  generateReport(): void {
    // ❌ Returns Promise, not Observable (harder to cancel/compose)
    this.store.generateReport(this.organizationId());
  }
}
```

**Problems with Signal Store approach:**

- ❌ Angular-only (desktop/CLI can't use it)
- ❌ Lost RxJS operators (must use Promises)
- ❌ Lost cancellation (no `switchMap`)
- ❌ Lost parallel loading (no `forkJoin`)
- ❌ Different architecture from rest of Bitwarden
- ❌ More code to achieve same result

---

## Conclusion

**The current Observable + Signal pattern is the right choice.**

NgRx Signals (Signal State/Store) are excellent tools for the right use case, but Access Intelligence is NOT that use case. The complexity, platform incompatibility, and loss of RxJS operators outweigh any potential benefits.

**For report progress tracking specifically, use a Signal** (not Observable) since it's simple UI state that doesn't need RxJS operators.

**Follow Bitwarden's ADR-0027:** Observables in services, Signals in components.

---

## Sources

- [NgRx Signals Official Guide](https://ngrx.io/guide/signals/signal-store)
- [Angular State Management for 2025 - Nx Blog](https://nx.dev/blog/angular-state-management-2025)
- [Mastering State Management in Angular with NgRx and Signals](https://angular.love/mastering-state-management-in-angular-with-ngrx-and-signals-scalable-predictable-performant/)
- [From RxJS to Signals: The Future of State Management in Angular - HackerNoon](https://hackernoon.com/from-rxjs-to-signals-the-future-of-state-management-in-angular)
- [NgRx Signal Store vs Signal State vs Simple Signal - Medium](https://medium.com/multitude-it-labs/ngrx-signal-store-vs-signal-state-vs-simple-signal-33ceb2f5ee1d)
- [Angular Signals & NgRx Signals Package: How to Pick the Right Strategy - Medium](https://medium.com/@schnabelelisa0/angular-signals-ngrx-signals-package-how-to-pick-the-right-state-management-strategy-3dc9b3644775)
- [State Management in Angular Apps Using NgRx Signal Store - Telerik](https://www.telerik.com/blogs/state-management-angular-applications-using-ngrx-signals-store)
- [Breakthrough in State Management – Signal Store Part 1](https://angular.love/breakthrough-in-state-management-discover-the-simplicity-of-signal-store-part-1/)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
