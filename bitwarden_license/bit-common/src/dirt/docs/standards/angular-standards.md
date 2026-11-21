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

## Related Documentation

**Standards:**

- [Model Standards](./model-standards.md) - Smart models and view construction patterns
- [RxJS Standards](./rxjs-standards.md) - Observable patterns for services
- [Service Standards](./service-standards.md) - Service patterns and state management
- [Testing Standards - Components](./testing-standards-components.md) - Testing OnPush components with Signals

**Playbooks:**

- [Component Migration Playbook](../playbooks/component-migration-playbook.md) - Migrating components to modern Angular patterns

**Navigation:**

- [Standards Hub](./README.md) - All DIRT team standards

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
