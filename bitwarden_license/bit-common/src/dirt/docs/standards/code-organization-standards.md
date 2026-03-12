# Code Organization Standards

**Purpose:** Standards for naming conventions, code organization, file structure, and documentation practices in Access Intelligence development

---

## Table of Contents

1. [Naming Conventions and Code Organization](#naming-conventions-and-code-organization)
   - [Observable Naming Convention](#observable-naming-convention)
   - [Private Variable Naming](#private-variable-naming)
   - [Hot vs Cold Observables](#hot-vs-cold-observables)
   - [Function and Method Ordering](#function-and-method-ordering)
   - [File and Service Naming](#file-and-service-naming)
2. [Comment and Documentation Standards](#comment-and-documentation-standards)
   - [Service Abstracts](#service-abstracts)
   - [Implementation Comments](#implementation-comments)
   - [TODO Comments](#todo-comments)

---

## Naming Conventions and Code Organization

### Observable Naming Convention

**Rule:** All Observables and functions returning Observables MUST end with `$` suffix.

**Why:** Makes it immediately clear that a value is an Observable stream that can be subscribed to.

**Pattern:**

```typescript
// ✅ CORRECT - Observable variables
export class DefaultAccessIntelligenceDataService {
  private _report = new BehaviorSubject<RiskInsightsView | null>(null);
  readonly report$ = this._report.asObservable(); // Public observable with $

  // ✅ CORRECT - Functions returning Observables
  generateReport$(orgId: OrganizationId): Observable<RiskInsightsView> {
    return this.reportGenerationService.generateReport$(ciphers, members, ...);
  }

  loadReport$(reportId: string): Observable<RiskInsightsView> {
    return this.apiService.getReport$(reportId);
  }
}

// ❌ WRONG - Missing $ suffix
readonly report = this._report.asObservable(); // Hard to tell it's an Observable
generateReport(orgId: OrganizationId): Observable<...> // Unclear return type
```

**Applies to:**

- Observable variables (`report$`, `drawer$`, `ciphers$`)
- Functions returning Observables (`generateReport$()`, `save$()`, `load$()`)
- Observable properties in interfaces
- Observable parameters (when not obvious from context)

**Exception:** Parameters where type is clear from signature can omit `$` if it improves readability:

```typescript
// Acceptable - type signature is clear
function combineReports(
  current: Observable<RiskInsightsView>,
  previous: Observable<RiskInsightsView>,
): Observable<RiskInsightsView>;
```

### Private Variable Naming

**Rule:** Private BehaviorSubject/Subject variables should use underscore prefix.

**Why:**

- Distinguishes private observable source from public observable stream
- Common TypeScript/Angular convention
- Makes the private/public pair relationship obvious

**Pattern:**

```typescript
// ✅ CORRECT - Private source with _, public observable with $
export class DefaultAccessIntelligenceDataService {
  private _report = new BehaviorSubject<RiskInsightsView | null>(null);
  readonly report$ = this._report.asObservable();

  private _drawerState = new BehaviorSubject<DrawerState>(defaultState);
  readonly drawerState$ = this._drawerState.asObservable();

  updateReport(view: RiskInsightsView): void {
    this._report.next(view); // Clearly using the private source
  }
}

// ❌ WRONG - No underscore prefix
private reportSubject = new BehaviorSubject<RiskInsightsView | null>(null);
readonly report$ = this.reportSubject.asObservable();
```

**Applies to:**

- BehaviorSubject instances
- Subject instances
- ReplaySubject instances

**Does NOT apply to:**

- Regular private methods
- Regular private properties (non-Observable)
- Private service dependencies

### Hot vs Cold Observables

Understanding the difference is critical for proper service design.

**Cold Observables** (Each subscription creates new execution):

```typescript
// ❌ BAD - Every subscription triggers new HTTP request
getReport$(id: string): Observable<RiskInsightsView> {
  return this.http.get<RiskInsightsApi>(`/api/reports/${id}`).pipe(
    map(api => RiskInsightsView.fromJSON(api))
  );
}

// Usage - 3 subscriptions = 3 HTTP requests!
service.getReport$("123").subscribe(...);
service.getReport$("123").subscribe(...);
service.getReport$("123").subscribe(...);
```

**Hot Observables** (Shared execution across subscriptions):

```typescript
// ✅ GOOD - BehaviorSubject shares state across all subscribers
export class DefaultAccessIntelligenceDataService {
  private _report = new BehaviorSubject<RiskInsightsView | null>(null);
  readonly report$ = this._report.asObservable();

  loadAndCacheReport$(id: string): Observable<RiskInsightsView> {
    return this.http.get<RiskInsightsApi>(`/api/reports/${id}`).pipe(
      map(api => RiskInsightsView.fromJSON(api)),
      tap(view => this._report.next(view)) // Cache in BehaviorSubject
    );
  }
}

// Usage - 3 subscriptions to report$ = same data, no extra requests
service.report$.subscribe(...);
service.report$.subscribe(...);
service.report$.subscribe(...);
```

**Converting Cold to Hot (shareReplay):**

```typescript
// ✅ GOOD - Use shareReplay to share execution
generateReport$(orgId: OrganizationId): Observable<RiskInsightsView> {
  return this.reportGenerationService.generateReport$(...).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );
  // Multiple subscribers = single execution
}
```

**When to use which:**

| Pattern             | Use When                                                 | Example                    |
| ------------------- | -------------------------------------------------------- | -------------------------- |
| **BehaviorSubject** | Shared state, needs current value                        | `report$`, `drawer$`       |
| **Cold Observable** | One-time operations, each subscriber needs own execution | Single HTTP GET            |
| **shareReplay**     | Expensive operation, want to share result                | Report generation pipeline |
| **Subject**         | Event bus, no initial value needed                       | User action events         |

### Function and Method Ordering

**Rule:** Organize class members by visibility and feature, not alphabetically.

**Standard Order:**

```typescript
export class DefaultReportGenerationService {
  // 1. Constructor & DI
  constructor(
    private cipherHealthService: CipherHealthService,
    private memberMappingService: MemberCipherMappingService,
  ) {}

  // 2. Public API Methods (grouped by feature)
  // === Report Generation (Primary Feature) ===
  generateReport$(
    ciphers: CipherView[],
    members: OrganizationUserView[],
  ): Observable<RiskInsightsView> {
    // ...
  }

  // === Health Checks (Secondary Feature) ===
  checkCipherHealth$(ciphers: CipherView[]): Observable<HealthMap> {
    // ...
  }

  // 3. Private Helper Methods (grouped by feature)
  // === Private: Aggregation Helpers ===
  private aggregateIntoReports(
    ciphers: CipherView[],
    healthMap: Map<string, CipherHealthView>,
  ): RiskInsightsReportView[] {
    // ...
  }

  private groupCiphersByApplication(ciphers: CipherView[]): Map<string, CipherView[]> {
    // ...
  }

  // === Private: Summary Helpers ===
  private computeSummary(reports: RiskInsightsReportView[]): RiskInsightsSummaryView {
    // ...
  }
}
```

**Ordering Principles:**

1. **Constructor first** - Always at the top
2. **Public before private** - API surface is most important
3. **Group by feature/responsibility** - Not alphabetical
4. **Related methods together** - Easier to understand flow
5. **Section comments** - Use `// ===` to mark feature groups

**Angular Components (special case):**

```typescript
@Component({ ... })
export class RiskInsightsComponent {
  // 1. Inputs/Outputs
  @Input() organizationId!: string;
  @Output() reportGenerated = new EventEmitter<void>();

  // 2. Public properties (used in template)
  report = toSignal(this.dataService.report$);

  // 3. Constructor
  constructor(private dataService: AccessIntelligenceDataService) {}

  // 4. Lifecycle hooks (in Angular lifecycle order)
  ngOnInit() { ... }
  ngOnDestroy() { ... }

  // 5. Public methods (grouped by feature)
  // === Report Actions ===
  generateReport(): void { ... }

  // === Application Actions ===
  markAsCritical(name: string): void { ... }

  // 6. Private methods
  private loadData(): void { ... }
}
```

**Why not alphabetical?**

- Features are more important than names
- Related methods should be adjacent
- Easier to navigate and understand
- Matches how code is typically read (top-down by feature)

### File and Service Naming

**Services:**

- Prefix: `access-intelligence-*` or `ai-*` for this feature area
- Suffix: `*.service.ts` for services
- Kebab-case: `access-intelligence-data.service.ts`

**Implementations:**

- Prefix with `Default`: `default-access-intelligence-data.service.ts`
- Alternative implementations: `mock-access-intelligence-data.service.ts`

**Abstractions:**

- Same name as implementation, in `abstractions/` folder
- `abstractions/access-intelligence-data.service.ts`

**Example Structure:**

```
services/
├── abstractions/
│   ├── report-generation.service.ts          (abstract class)
│   ├── cipher-health.service.ts              (abstract class)
│   └── member-cipher-mapping.service.ts      (abstract class)
└── implementations/
    ├── default-report-generation.service.ts
    ├── default-cipher-health.service.ts
    └── default-member-cipher-mapping.service.ts
```

### Documentation File Naming

**See:** [Documentation Standards](./documentation-standards.md#naming-conventions) for complete documentation naming conventions.

**Quick reference:**

- **Meta files:** `README.md`, `CLAUDE.md` (ALL CAPS)
- **Regular docs:** `lowercase-kebab-case.md`
- **Playbooks:** `[topic]-playbook.md`
- **ADRs:** `NNN-descriptive-title.md`

### Component Folder Structure

**Rule:** Every component MUST have its own folder (as of 2026-02-18).

**Pattern:**

```
components/
├── my-component/
│   ├── my-component.component.ts
│   ├── my-component.component.html
│   ├── my-component.component.spec.ts
│   └── my-component.component.stories.ts
└── shared/
    ├── shared-component/
    │   └── [component files]
    └── test-helpers/
        └── [test utilities]
```

**Folder Naming:**

- Match component file name exactly (without `.component.ts`)
- Use kebab-case
- Keep version suffixes if present (e.g., `all-activity-v2/`)

**Rationale:**

- Reduces visual clutter in directories
- Groups related files together
- Easier to find and navigate components
- Matches modern Angular component organization patterns

**Barrel Exports (app components):** NOT required for app components. Optional for library components.

**Barrel Exports (models):** The `access-intelligence/models/` folder has a required barrel (`models/index.ts`).
All external consumers MUST import from the barrel — never from individual model files. See
[Model Standards — Barrel Imports](./model-standards.md#barrel-imports-required) for the full rule and examples.

---

## Comment and Documentation Standards

### Service Abstracts

**Purpose:** API contract and primary documentation. Focus on WHAT, not WHY or HOW.

**DO:**

- Describe what the service does (1-2 sentences)
- Document parameters with `@param`, returns with `@returns`
- Provide usage examples with `@example`
- Explain input/output structure

**DON'T:**

- Include architectural decisions (belongs in architecture docs)
- Explain WHY certain approaches were chosen
- Document performance characteristics or trade-offs
- Add TODO comments
- Start documentation with "This function", "This service", "This method", "This class", or similar phrases (company-wide standard — say what it does, not what it is)

**Good Example:**

````typescript
/**
 * Generates Risk Insights reports from pre-loaded organization data.
 *
 * Orchestrates health checks, member mapping, aggregation, and summary computation
 * to produce a complete RiskInsightsView. Does NOT handle data loading or persistence.
 *
 * @param ciphers - Organization ciphers to analyze
 * @param members - Organization members/users
 * @returns Observable of complete RiskInsightsView ready for persistence
 *
 * @example
 * ```typescript
 * this.reportGenService.generateReport(ciphers, members, collectionAccess, groupMemberships)
 *   .pipe(switchMap(report => this.persistenceService.save(report)))
 *   .subscribe();
 * ```
 */
abstract generateReport(...): Observable<RiskInsightsView>;
````

### Implementation Comments

**Purpose:** Explain HOW and WHY for maintainers, not API users.

**DO:**

- Comment on non-obvious implementation choices
- Explain workarounds or edge cases
- Document why certain patterns are used (if not obvious)

**DON'T:**

- Repeat what the code already says
- Add TODO comments (use Jira tickets instead)
- Over-comment simple operations

**Good Example:**

```typescript
// Mutate in place to avoid 10-15 MB allocation on each update
view.markApplicationAsCritical(appName);
this._report.next(view); // Emit triggers subscribers even with same reference
```

### JSDoc Cross-References (`{@link}`)

**Rule:** Imports used solely for JSDoc `{@link}` cross-references are acceptable with a
lint suppression, provided the link adds genuine IDE navigation value.

**Pattern:**

```typescript
// ✅ ACCEPTABLE - Import exists only to make {@link} navigable in IDEs
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApi } from "../api/risk-insights.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsData } from "../data/risk-insights.data";

/**
 * View model for Risk Insights containing decrypted properties
 *
 * - See {@link RiskInsights} for domain model
 * - See {@link RiskInsightsData} for data model
 * - See {@link RiskInsightsApi} for API model
 */
export class RiskInsightsView implements View { ... }
```

**When to use:**

- Cross-layer references in the 4-layer model architecture (Api → Data → Domain → View)
- When the linked type provides meaningful navigational context for maintainers

**When NOT to use:**

- If the linked type no longer exists or the mapping is no longer accurate
- If the reference is speculative or architectural documentation belongs elsewhere

**Maintenance note:** `{@link}` references should be reviewed alongside architecture changes.
If the 4-layer mapping shifts (e.g., a model is merged, renamed, or goes away), update
or remove the corresponding `{@link}` reference and its suppression import.

### TODO Comments

**Rule:** NO TODO comments in abstract classes or production code paths.

**Instead:**

1. Create a Jira ticket for future work
2. Document in architecture docs if it's a known limitation
3. Use stub with clear comment if implementation is deferred (rare)

---

## Where to Document Decisions

**Rule:** Architectural decisions and design rationale do NOT belong in code comments or service abstracts.

**See:** [Documentation Standards](./documentation-standards.md#document-location-rules) for guidance on where to document:

- Architecture Decision Records (ADRs)
- Architecture documentation
- Implementation decisions
- Design rationale

**Quick reference:**

- **ADRs** - Major architectural decisions (e.g., "Why Records instead of arrays")
- **Architecture docs** - System design, flows, patterns
- **Code comments** - Implementation details, non-obvious logic only
- **Standards** - Team conventions and patterns

---

## Related Documentation

**Standards:**

- [Documentation Standards](./documentation-standards.md) - Documentation naming, structure, and location rules
- [RxJS Standards](./rxjs-standards.md) - Observable naming and patterns
- [Service Standards](./service-standards.md) - Service organization and helper function guidelines
- [Angular Standards](./angular-standards.md) - Angular-specific patterns

**Navigation:**

- [Standards Hub](./README.md) - All DIRT team standards

---

**Document Version:** 1.3
**Last Updated:** 2026-03-12
**Maintainer:** DIRT Team
