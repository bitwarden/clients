# Service Standards

**Purpose:** Standards for service responsibility patterns, separation of concerns, and helper function extraction in Access Intelligence development

---

## Service Responsibility Patterns

### Service Responsibility Matrix

| Service                           | Loads Data | Generates Reports | Saves/Loads       | Exposes State      | Manages UI |
| --------------------------------- | ---------- | ----------------- | ----------------- | ------------------ | ---------- |
| **AccessIntelligenceDataService** | ✅ Yes     | ❌ No (delegates) | ❌ No (delegates) | ✅ Yes (`report$`) | ❌ No      |
| **ReportGenerationService**       | ❌ No      | ✅ Yes            | ❌ No             | ❌ No              | ❌ No      |
| **ReportPersistenceService**      | ❌ No      | ❌ No             | ✅ Yes            | ❌ No              | ❌ No      |
| **CipherHealthService**           | ❌ No      | ❌ No             | ❌ No             | ❌ No              | ❌ No      |
| **MemberCipherMappingService**    | ❌ No      | ❌ No             | ❌ No             | ❌ No              | ❌ No      |
| **DrawerStateService**            | ❌ No      | ❌ No             | ❌ No             | ✅ Yes (`drawer$`) | ✅ Yes     |

### AccessIntelligenceDataService (Orchestrator)

**Single Responsibility:** Orchestrate data loading, generation, persistence, and state management.

**Pattern:**

```typescript
export class DefaultAccessIntelligenceDataService {
  private _report = new BehaviorSubject<RiskInsightsView | null>(null);
  readonly report$ = this._report.asObservable();

  generateNewReport(orgId: OrganizationId): Observable<void> {
    // 1. Load data (this service's responsibility)
    return forkJoin({
      ciphers: from(this.cipherService.getAllFromApiForOrganization(orgId)),
      members: from(this.organizationService.getOrganizationUsers(orgId)),
      // ... load collections and groups
    }).pipe(
      // 2. Generate report (delegate to ReportGenerationService)
      switchMap((data) => this.reportGenerationService.generateReport(...data)),

      // 3. Save report (delegate to ReportPersistenceService)
      switchMap((view) => this.reportPersistenceService.save(view)),

      // 4. Update state (this service's responsibility)
      tap((savedView) => this._reportSubject.next(savedView)),
    );
  }

  markApplicationAsCritical(appName: string): Observable<void> {
    const current = this._report.value;
    current.markApplicationAsCritical(appName); // Mutate
    this._report.next(current); // Emit
    return this.reportPersistenceService.save(current); // Persist
  }
}
```

### ReportGenerationService (Pure Transformation)

**Single Responsibility:** Transform pre-loaded data into RiskInsightsView.

**Pattern:**

```typescript
export class DefaultReportGenerationService {
  generateReport(
    ciphers: CipherView[], // Pre-loaded by caller
    members: OrganizationUserView[], // Pre-loaded by caller
    collectionAccess: CollectionAccessDetails[], // Pre-loaded by caller
    groupMemberships: GroupMembershipDetails[], // Pre-loaded by caller
    previousApplications?: RiskInsightsApplicationView[],
  ): Observable<RiskInsightsView> {
    // Run health checks + member mapping → aggregate → build view
    // Does NOT load data, does NOT save data
  }
}
```

**Why this pattern:**

- Data service controls WHEN to reload vs reuse cached data
- Generation service is pure transformation (easier to test)
- Ciphers can be exposed via `ciphers$` for `getCipherIcon()` and other UI needs

---

## Helper Functions vs Service Methods

**Rule:** Helper functions should only be extracted into separate files if they are **shared across multiple services**.

**Pattern 1: Private Methods (Preferred)**

```typescript
// ✅ CORRECT - Used only by this service
export class DefaultReportGenerationService {
  private groupCiphersByApplication(ciphers: CipherView[]): Map<string, CipherView[]> {
    // ... implementation
  }
}
```

**Pattern 2: Shared Helpers (Only when needed)**

```typescript
// ✅ CORRECT - Used by multiple services
// helpers/risk-insights-data-mappers.ts
export function getTrimmedCipherUris(cipher: CipherView): string[] {
  // ... used by ReportGenerationService AND other services
}
```

**Why:**

- Reduces file bloat
- Clearer ownership (method belongs to the service)
- Only extract when reuse is proven, not speculative

**User feedback that led to this standard:**

> "Helper functions should only be taken out of services if they are going to be used in other services."

---

## Related Documentation

**Standards:**

- [Model Standards](./model-standards.md) - 4-layer model architecture used by services
- [RxJS Standards](./rxjs-standards.md) - Observable patterns and error handling
- [Code Organization Standards](./code-organization-standards.md) - Service naming and organization
- [Testing Standards - Services](./testing-standards-services.md) - Testing service patterns

**Navigation:**

- [Standards Hub](./README.md) - All DIRT team standards

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
