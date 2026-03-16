# Access Intelligence Architecture Review — Old vs New Implementation

**Purpose:** Comprehensive comparison of original vs service-oriented architecture to validate refactor direction

---

## Context

This review compares the **original Access Intelligence architecture** (Risk Insights Orchestrator + Report Service) with the **new service-oriented architecture** to validate that the refactor is on track and identify any missing features or architectural concerns.

**Scope of Review:**

- Report generation logic
- Report persistence and loading
- Encryption/decryption handling
- Model architecture
- State management patterns
- Feature completeness

---

## 1. Architecture Comparison — High-Level

### Old Architecture (Orchestrator Pattern)

**Core Services:**

- [risk-insights-orchestrator.service.ts](../../services/domain/risk-insights-orchestrator.service.ts) — **1,242 lines**, monolithic orchestrator
- [risk-insights-report.service.ts](../../services/domain/risk-insights-report.service.ts) — **400 lines**, mixed responsibilities

**Characteristics:**

- ✅ **Works** but violates Single Responsibility Principle
- ❌ **Massive orchestrator** handles everything: data loading, generation, persistence, encryption, state management, critical app updates, migration, UI state
- ❌ **Complex reactive pipelines** with deeply nested `switchMap`/`forkJoin`/`combineLatest`
- ❌ **Tight coupling** between concerns (can't test generation without mocking persistence)
- ❌ **Difficult to test** due to dependencies on 10+ services
- ❌ **Hard to extend** — adding features requires modifying the orchestrator
- ⚠️ **Array-based models** — duplicates member data across every application (memory inefficient)

### New Architecture (Service-Oriented)

**Core Services:**

- [report-generation.service.ts](../../services/abstractions/report-generation.service.ts) — Pure transformation
- [report-persistence.service.ts](../../services/abstractions/report-persistence.service.ts) — Save/load orchestration
- [cipher-health.service.ts](../../services/abstractions/cipher-health.service.ts) — Health checks
- [member-cipher-mapping.service.ts](../../services/abstractions/member-cipher-mapping.service.ts) — Client-side member resolution
- **AccessIntelligenceDataService** Top-level orchestrator

**Characteristics:**

- ✅ **Single Responsibility** — each service has one clear purpose
- ✅ **Testable** — services can be tested in isolation with minimal mocking
- ✅ **Extensible** — new features don't require modifying core services
- ✅ **4-Layer Model Architecture** — API → Data → Domain → View (follows Cipher pattern)
- ✅ **Smart View Models** — business logic lives on models, not scattered across services
- ✅ **Member Registry Pattern** — 98% reduction in duplicate member data
- ✅ **Clear boundaries** — abstractions define contracts, implementations stay focused

---

## 2. Feature Parity Analysis — What's Migrated?

### ✅ Report Generation (Complete)

**Old:** `RiskInsightsOrchestratorService._generateNewApplicationsReport$()`

- Lines 663-794 (132 lines of complex RxJS)
- Mixed: data loading + health checks + aggregation + encryption + persistence

**New:** `DefaultReportGenerationService.generateReport()`

- [default-report-generation.service.ts:34-73](../../services/implementations/default-report-generation.service.ts#L34-L73) (40 lines)
- Pure transformation: takes pre-loaded data → returns AccessReportView
- Delegates health checks to `CipherHealthService`
- Delegates member mapping to `MemberCipherMappingService`

**Status:** ✅ **Feature complete**. New implementation is cleaner, more testable, and follows standards.

---

### ✅ Cipher Health Checks (Complete)

**Old:** `RiskInsightsOrchestratorService._getCipherHealth()`

- Lines 847-878 (32 lines)
- Mixed with orchestrator concerns

**New:** `DefaultCipherHealthService`

- [default-cipher-health.service.ts](../../services/implementations/default-cipher-health.service.ts)
- Checks weak passwords (zxcvbn), password reuse, HIBP exposure
- Concurrency-limits HIBP calls (`MAX_CONCURRENT_HIBP_CALLS = 5`)
- Returns `Map<cipherId, CipherHealthView>` for O(1) lookups

**Status:** ✅ **Feature complete + improved**. Concurrency limiting prevents HIBP rate limiting (not in old implementation).

---

### ✅ Member-Cipher Mapping (Complete)

**Old:** Server-side API call

- `MemberCipherDetailsApiService.getMemberCipherDetails(organizationId)`
- **Performance issue:** Timed out for large orgs (10K members)

**New:** `DefaultMemberCipherMappingService`

- [default-member-cipher-mapping.service.ts](../../services/implementations/default-member-cipher-mapping.service.ts)
- Client-side resolution via collections + groups
- Returns `{ mapping: Map<cipherId, memberIds[]>, registry: MemberRegistry }`
- **Performance improvement:** 81% reduction in report size (786MB → 150MB for 10K members)

**Status:** ✅ **Feature complete + significantly improved**. Eliminates server-side bottleneck.

---

### ✅ Report Persistence (Complete)

**Old:** `RiskInsightsReportService.saveRiskInsightsReport$()`

- Lines 226-291 (66 lines)
- Handles encryption + API call + response validation

**New:** `DefaultReportPersistenceService`

- [default-report-persistence.service.ts](../../services/implementations/default-report-persistence.service.ts)
- `saveReport()` — Full report save
- `saveApplicationMetadata()` — Update apps + summary (for critical marking)
- `loadReport()` — Fetch + decrypt + construct view

**Status:** ✅ **Feature complete**. Cleaner separation: encryption logic moved to domain models.

---

### ✅ Encryption/Decryption (Complete)

**Old:** Service-based encryption

- `RiskInsightsEncryptionService` handles all encryption
- Services call encryption service directly

**New:** Domain-based encryption (Cipher pattern)

- [risk-insights.ts:59-98](../../models/domain/risk-insights.ts#L59-L98) — `decrypt()` method
- [risk-insights.ts:132-213](../../models/domain/risk-insights.ts#L132-L213) — `fromView()` (encrypt)
- Domain models handle their own encryption/decryption
- Service provides encryption primitives, domain orchestrates usage

**Status:** ✅ **Feature complete + follows Cipher pattern**. Aligns with Bitwarden's 4-layer architecture.

---

### ✅ Smart View Models (New Feature)

**Old:** Dumb data bags

- `ApplicationHealthReportDetail` — plain object with arrays
- No query methods, no business logic
- Services do all the work

**New:** Smart view models with query/update methods

- [access-report.view.ts:77-143](../../models/view/access-report.view.ts#L77-L143) — Query methods:
  - `getAtRiskMembers()` — Deduplicated at-risk members
  - `getCriticalApplications()` — Filter by critical flag
  - `getNewApplications()` — Filter by reviewedDate
  - `getApplicationByName(name)` — Find specific app
  - `getTotalMemberCount()` — Count members in registry
- [access-report.view.ts:145-208](../../models/view/access-report.view.ts#L145-L208) — Update methods:
  - `markApplicationAsCritical(name)` — Mutate + recompute summary
  - `unmarkApplicationAsCritical(name)` — Mutate + recompute summary
  - `markApplicationAsReviewed(name)` — Update reviewedDate
- [access-report.view.ts:222-257](../../models/view/access-report.view.ts#L222-L257) — Computation methods:
  - `recomputeSummary()` — Aggregate counts from reports + applications

**Status:** ✅ **New feature**. Follows CipherView pattern, makes business logic testable and reusable.

---

### ✅ Member Registry Pattern (New Feature)

**Old:** Duplicate member arrays in every application

- `ApplicationHealthReportDetail.memberDetails: MemberDetails[]`
- `ApplicationHealthReportDetail.atRiskMemberDetails: MemberDetails[]`
- **Memory issue:** 5,000 members × 50 apps × 180 bytes = ~45MB of duplicated data

**New:** Shared member registry + ID references

- [access-report.view.ts:43](../../models/view/access-report.view.ts#L43) — `type MemberRegistry = Record<string, MemberRegistryEntry>`
- [application-health.view.ts:36](../../models/view/application-health.view.ts#L36) — `memberRefs: Record<memberId, isAtRisk>`
- **Memory savings:** 5,000 members × 140 bytes = ~700KB (98% reduction)

**Status:** ✅ **New feature**. Major performance improvement for large organizations.

---

## 3. Missing Features — What Needs Migration?

### ✅ AccessIntelligenceDataService (Implemented)

**Old:** `RiskInsightsOrchestratorService`

- Lines 72-154: State management (`_userId$`, `organizationDetails$`, `_ciphers$`, `hasCiphers$`, `rawReportData$`, `enrichedReportData$`, `newApplications$`, `criticalReportResults$`, etc.)
- Lines 168-176: Setup methods (`_setupCriticalApplicationContext`, `_setupCriticalApplicationReport`, `_setupEnrichedReportData`, etc.)
- Lines 193-196: `generateReport()` trigger
- Lines 220-223: `initializeForOrganization(orgId)` entry point
- Lines 231-357: `removeCriticalApplications$(apps)` — Update critical flags + save
- Lines 359-489: `saveCriticalApplications$(apps)` — Mark apps as critical + save
- Lines 498-639: `saveApplicationReviewStatus$(apps)` — Mark apps as reviewed + save

**New:** `DefaultAccessIntelligenceDataService`

**Implemented in:** `implementations/view/default-access-intelligence-data.service.ts`

**What it does:**

1. **State Management**:
   - `report$: Observable<AccessReportView | null>` — Current report (BehaviorSubject)
   - `loading$: Observable<boolean>` — Loading state
   - `error$: Observable<string | null>` — Error state
   - `progress$: Observable<ReportProgress | null>` — Generation progress

2. **Data Loading**:
   - `initializeForOrganization$(orgId)` — Load existing report; re-saves if `hadLegacyBlobs` detected
   - Fetches org data (ciphers, members, groups, collections) inline during generation

3. **Report Operations**:
   - `generateNewReport$(orgId)` — Emits progress → loads org data → generate → save → emit report
   - Progress states: `FetchingMembers` → `AnalyzingCredentials` → `CalculatingRisks` → `GeneratingReport` → `Saving` → `Complete`

4. **Application Metadata Updates** (all with rollback on error):
   - `markApplicationsAsCritical$(names[])` — Mutate view + persist + emit
   - `unmarkApplicationsAsCritical$(names[])` — Mutate view + persist + emit
   - `markApplicationsAsReviewed$(names[], date?)` — Mutate view + persist + emit

**Status:** ✅ **Complete** — Implemented in `implementations/view/default-access-intelligence-data.service.ts`.

---

### ⚠️ Critical App Migration Logic (May Not Need Migration)

**Old:** `RiskInsightsOrchestratorService._runMigrationAndCleanup$()`

- Lines 932-970: Migrates critical apps from old `CriticalAppsService` to new report-based storage
- One-time migration for existing users

**New:** **Not implemented**

**Decision:** ⚠️ **Probably not needed in new architecture**

- This was a one-time migration from legacy storage
- If new architecture is deployed fresh, no migration needed
- If deploying alongside old code, migration can be handled in a separate migration service or feature flag

**Status:** ⚠️ **Defer decision** — Discuss with team whether migration is needed.

---

### ✅ Drawer State Management (Complete)

**Old:** Mixed into orchestrator

- Drawer state managed separately in UI layer

**New:** `DefaultDrawerStateService`

- [default-drawer-state.service.ts](../../services/implementations/default-drawer-state.service.ts)
- Manages drawer open/close state
- Exposes `drawer$: Observable<DrawerState>`

**Status:** ✅ **Feature complete**. Clean separation of UI state from data state.

---

## 4. Architectural Concerns & Recommendations

### ✅ **RESOLVED: AccessIntelligenceDataService Implemented**

**Resolution:** The top-level orchestrator is now fully implemented.

**Implementation:** `DefaultAccessIntelligenceDataService` in
`implementations/view/default-access-intelligence-data.service.ts`

**Provides:**

- Observable state management (`report$`, `loading$`, `error$`, `progress$`)
- Data loading (fetches org data inline during report generation)
- Report operations (`initializeForOrganization$()`, `generateNewReport$()`)
- Application metadata updates with rollback (`markApplicationsAsCritical$()`, etc.)
- Progress tracking through generation pipeline

**Status:** ✅ **Resolved**.

---

### 🟡 **MEDIUM: Metrics Computation**

**Old:** `RiskInsightsOrchestratorService._getReportMetrics()`

- Lines 800-839: Computes password-level metrics (total passwords, at-risk passwords, critical passwords)

**New:** `DefaultReportPersistenceService.computeMetrics()`

- Lines 182-201: **Incomplete** — only copies summary counts, **password counts hardcoded to 0**

**Issue:**

```typescript
// ❌ Missing password counts
metrics.totalPasswordCount = 0;
metrics.totalAtRiskPasswordCount = 0;
metrics.totalCriticalPasswordCount = 0;
metrics.totalCriticalAtRiskPasswordCount = 0;
```

**Recommendation:**

- Move metrics computation to `AccessReportView.toMetrics()` method
- View model already has all the data (reports with cipherRefs, applications with isCritical)
- Example:

```typescript
// In AccessReportView
toMetrics(): AccessReportMetrics {
  const metrics = new AccessReportMetrics();

  // Copy summary counts
  metrics.totalApplicationCount = this.summary.totalApplicationCount;
  // ... copy other summary fields

  // Compute password counts from reports
  let totalPasswordCount = 0;
  let totalAtRiskPasswordCount = 0;
  let totalCriticalPasswordCount = 0;
  let totalCriticalAtRiskPasswordCount = 0;

  const criticalAppNames = new Set(
    this.applications.filter(a => a.isCritical).map(a => a.applicationName)
  );

  this.reports.forEach(report => {
    const isCritical = criticalAppNames.has(report.applicationName);
    const passwordCount = Object.keys(report.cipherRefs).length;
    const atRiskCount = report.getAtRiskCipherIds().length;

    totalPasswordCount += passwordCount;
    totalAtRiskPasswordCount += atRiskCount;

    if (isCritical) {
      totalCriticalPasswordCount += passwordCount;
      totalCriticalAtRiskPasswordCount += atRiskCount;
    }
  });

  metrics.totalPasswordCount = totalPasswordCount;
  metrics.totalAtRiskPasswordCount = totalAtRiskPasswordCount;
  metrics.totalCriticalPasswordCount = totalCriticalPasswordCount;
  metrics.totalCriticalAtRiskPasswordCount = totalCriticalAtRiskPasswordCount;

  return metrics;
}
```

**Priority:** 🟡 **Medium** — Metrics are used for reporting/analytics but don't block core features.

---

### 🟡 **MEDIUM: Report Progress Tracking**

**Old:** `RiskInsightsOrchestratorService._reportProgressSubject`

- Lines 139-140: Exposes `reportProgress$: Observable<ReportProgress | null>`
- Lines 668-762: Updates progress during report generation:
  - `ReportProgress.FetchingMembers`
  - `ReportProgress.AnalyzingCredentials`
  - `ReportProgress.CalculatingRisks`
  - `ReportProgress.GeneratingReport`
  - `ReportProgress.Saving`
  - `ReportProgress.Complete`

**New:** ✅ **Implemented** — `progress$: Observable<ReportProgress | null>` exposed by
`AccessIntelligenceDataService`. Emits during `generateNewReport$()`:

- `FetchingMembers` → `AnalyzingCredentials` → `CalculatingRisks` → `GeneratingReport` → `Saving` → `Complete`

**Status:** ✅ **Complete**.

---

### 🟢 **LOW: New Applications Observable**

**Old:** `RiskInsightsOrchestratorService.newApplications$`

- Lines 109-132: Observable that filters reports to only unreviewed apps

**New:** **Not exposed as Observable**

**Current:**

- `AccessReportView.getNewApplications()` — Returns array
- Can be used in `AccessIntelligenceDataService` like:
  ```typescript
  newApplications$ = this.report$.pipe(map((report) => report?.getNewApplications() ?? []));
  ```

**Recommendation:**

- Add `newApplications$` to `AccessIntelligenceDataService` if UI needs reactive updates
- Or use `report$` + `getNewApplications()` directly in components

**Priority:** 🟢 **Low** — Easy to add when needed.

---

### 🟢 **LOW: Critical Applications Observable**

**Old:** `RiskInsightsOrchestratorService.criticalReportResults$`

- Lines 143-146, 992-1017: Observable that filters report to only critical apps + recomputes summary

**New:** **Not exposed as Observable**

**Current:**

- `AccessReportView.getCriticalApplications()` — Returns array of critical reports
- Can compute critical summary on-demand

**Recommendation:**

- Add `criticalReport$` to `AccessIntelligenceDataService` if needed:

  ```typescript
  criticalReport$ = this.report$.pipe(
    map((report) => {
      if (!report) return null;

      const criticalReports = report.getCriticalApplications();
      const criticalView = new AccessReportView();
      criticalView.reports = criticalReports;
      criticalView.applications = report.applications.filter((a) => a.isCritical);
      criticalView.memberRegistry = report.memberRegistry;
      criticalView.summary = report.summary; // Or recompute for critical-only

      return criticalView;
    }),
  );
  ```

**Priority:** 🟢 **Low** — Add if UI needs it.

---

### 🟢 **LOW: Enriched Report Data Observable**

**Old:** `RiskInsightsOrchestratorService.enrichedReportData$`

- Lines 105-106, 1023-1052: Observable that adds `isMarkedAsCritical` flag to each report

**New:** **Not needed**

**Why:**

- New view models already have query methods:
  - `view.getCriticalApplications()` — Filter reports by critical flag
  - `report.isMarkedAsCritical()` can be implemented as:
    ```typescript
    isMarkedAsCritical(applications: RiskInsightsApplicationView[]): boolean {
      return applications.some(a => a.applicationName === this.applicationName && a.isCritical);
    }
    ```
- Enrichment happens naturally through view model methods

**Recommendation:** ✅ **No action needed** — View model query methods replace this.

**Priority:** 🟢 **Low** — Already solved.

---

### 🟢 **LOW: getCipherIcon() Helper**

**Old:** `RiskInsightsOrchestratorService.getCipherIcon(cipherId)`

- Lines 204-213: Returns `CipherViewLike` for icon display
- Used by UI to show cipher favicons

**New:** **Not implemented**

**Recommendation:**
Add to `AccessIntelligenceDataService`:

```typescript
getCipherIcon(cipherId: string): CipherViewLike | undefined {
  const ciphers = this._ciphers.value;
  return ciphers?.find(c => c.id === cipherId);
}
```

**Priority:** 🟢 **Low** — Simple helper, easy to add.

---

## 5. Model Architecture Review

### ✅ 4-Layer Architecture (Excellent)

**Old:** Mixed layers

- `ApplicationHealthReportDetail` — combines view + domain concerns
- `OrganizationReportSummary` — plain interface, no domain/view separation

**New:** Clean 4-layer separation

- **API Layer:** [models/api/](../../models/api/) — Wire format
- **Data Layer:** [models/data/](../../models/data/) — Serializable format
- **Domain Layer:** [models/domain/](../../models/domain/) — Encrypted fields + encryption logic
- **View Layer:** [models/view/](../../models/view/) — Decrypted + query methods

**Flow:**

```
API → Data → Domain → View  (Load)
View → Domain → Data → API  (Save)
```

**Status:** ✅ **Excellent**. Follows Bitwarden's Cipher pattern exactly.

---

### ✅ Smart View Models (Excellent)

**Old:** Dumb data bags

- Business logic scattered across services
- Components manipulate data directly

**New:** Smart view models (CipherView pattern)

- [AccessReportView](../../models/view/access-report.view.ts) — Query methods + update methods + computation methods
- [ApplicationHealthView](../../models/view/application-health.view.ts) — Query methods for members/ciphers

**Benefits:**

- Business logic testable in isolation
- Cleaner service code (delegates to view methods)
- Intuitive API: `view.markApplicationAsCritical(name)`

**Status:** ✅ **Excellent**. Major improvement over old architecture.

---

### ✅ Member Registry Pattern (Excellent)

**Performance Impact:**

- **Old:** 786MB report for 10K members (duplicated across 50 apps)
- **New:** 150MB report for 10K members (deduplicated registry)
- **Savings:** 81% reduction

**Implementation:**

- [MemberRegistry](../../models/view/access-report.view.ts#L43) — `Record<userId, MemberRegistryEntry>`
- [ApplicationHealthView.memberRefs](../../models/view/application-health.view.ts#L36) — `Record<userId, isAtRisk>`
- Query methods resolve IDs to full entries on-demand

**Status:** ✅ **Excellent**. Major performance improvement.

---

### ⚠️ Domain Encryption Pattern (Minor Issue)

**Issue:** `RiskInsights.fromView()` re-expands member arrays for encryption

[risk-insights.ts:144-164](../../models/domain/risk-insights.ts#L144-L164):

```typescript
const memberDetails = Object.keys(report.memberRefs).map((memberId) => {
  const member = view.memberRegistry[memberId];
  return {
    userGuid: memberId,
    userName: member?.userName ?? "",
    email: member?.email ?? "",
    cipherId: "", // Not needed for encryption payload
  };
});
```

**Why it's OK:**

- This is only for encryption/persistence
- The expanded arrays are encrypted as JSON strings
- View models still use efficient Record-based storage
- Only happens during save (rare operation)

**Status:** ⚠️ **Acceptable**. Could optimize later if save performance becomes an issue.

---

## 6. Summary — Overall Architecture Assessment

### ✅ Major Wins

1. **Separation of Concerns** — Services have single, clear responsibilities
2. **Testability** — Pure functions, clear inputs/outputs, minimal mocking
3. **4-Layer Architecture** — Follows Bitwarden Cipher pattern exactly
4. **Smart View Models** — Business logic on models, not scattered across services
5. **Member Registry Pattern** — 81% memory reduction for large organizations
6. **Client-Side Member Mapping** — Eliminates server-side timeout issues
7. **Standards Compliance** — Follows all standards from [standards.md](../../standards/standards.md)

### ✅ Resolved Since Initial Review

1. **AccessIntelligenceDataService** — ✅ Implemented (`implementations/view/default-access-intelligence-data.service.ts`)
2. **Progress Tracking** — ✅ Implemented (exposed as `progress$` with 6 states)

### 🚧 Remaining Work

1. **Metrics Computation** — May still be incomplete (password counts); verify `AccessReportView.toMetrics()` computes password-level counts correctly
2. **Migration Logic** — Decision needed: migrate or deploy fresh?

### 🟢 Minor Gaps (Easy to Add)

1. `newApplications$` Observable
2. `criticalReport$` Observable
3. `getCipherIcon()` helper
4. Progress states during generation

---

## 7. Recommendations — Next Steps

### Phase 1: Complete Core Services (Priority 1) — ✅ DONE

1. ✅ **AccessIntelligenceDataService** — Implemented
   - State management (`report$`, `loading$`, `error$`, `progress$`)
   - Data loading (fetches org data inline during generation)
   - Report operations (`initializeForOrganization$()`, `generateNewReport$()`)
   - Application metadata updates with rollback

2. 🚧 **Fix Metrics Computation** — Verify status
   - `AccessReportView.toMetrics()` method exists; verify password-level counts are correct
   - `DefaultReportPersistenceService` uses `view.toMetrics()` during save

### Phase 2: Polish & Enhancement (Priority 2) — ✅ DONE

3. ✅ **Progress Tracking** — Implemented
   - `progress$: Observable<ReportProgress | null>` exposed by AccessIntelligenceDataService
   - Emits 6 states during `generateNewReport$()` pipeline

4. ✅ **Derived Observables** — Available via view model methods
   - `report.getNewApplications()` — unreviewed apps
   - `report.getCriticalApplications()` — critical apps

### Phase 3: Migration & Cleanup (Priority 3)

5. ⚠️ **Decide on Migration Strategy**
   - If deploying fresh: skip migration logic
   - If deploying alongside old code: implement migration service

6. ✅ **Remove Old Services**
   - Deprecate `RiskInsightsOrchestratorService`
   - Deprecate old `RiskInsightsReportService` (or keep minimal compatibility layer)
   - Update all components to use `AccessIntelligenceDataService`

---

## 8. Architecture Validation — ✅ APPROVED

**Overall Assessment:** 🟢 **The new architecture is sound and ready to proceed.**

**Strengths:**

- Clean service boundaries
- Testable, focused implementations
- Follows Bitwarden patterns (4-layer, Cipher, Observable Data Services)
- Significant performance improvements (81% memory reduction)
- Eliminates server-side bottlenecks (client-side member mapping)

**Concerns Addressed:**

- ✅ Report generation: Complete and improved
- ✅ Persistence: Complete with clean encryption pattern
- ✅ Cipher health: Complete with concurrency limiting
- ✅ Member mapping: Complete with major performance win
- ✅ Model architecture: Excellent 4-layer + smart models
- ✅ Orchestrator (AccessIntelligenceDataService): Implemented
- 🟡 Metrics computation: Minor fix needed
- 🟢 Progress tracking: Enhancement, not blocker

**Recommendation:** ✅ **Proceed with AccessIntelligenceDataService implementation.**

---

## Appendix: File References

### Old Architecture

- [risk-insights-orchestrator.service.ts](../../services/domain/risk-insights-orchestrator.service.ts) — 1,242 lines
- [risk-insights-report.service.ts](../../services/domain/risk-insights-report.service.ts) — 400 lines

### New Architecture — Services

- [report-generation.service.ts](../../services/abstractions/report-generation.service.ts) — Abstract
- [default-report-generation.service.ts](../../services/implementations/default-report-generation.service.ts) — 216 lines
- [report-persistence.service.ts](../../services/abstractions/report-persistence.service.ts) — Abstract
- [default-report-persistence.service.ts](../../services/implementations/default-report-persistence.service.ts) — 203 lines
- [cipher-health.service.ts](../../services/abstractions/cipher-health.service.ts) — Abstract
- [default-cipher-health.service.ts](../../services/implementations/default-cipher-health.service.ts) — 207 lines
- [member-cipher-mapping.service.ts](../../services/abstractions/member-cipher-mapping.service.ts) — Abstract
- [default-member-cipher-mapping.service.ts](../../services/implementations/default-member-cipher-mapping.service.ts) — 183 lines

### New Architecture — Models

- [access-report.view.ts](../../models/view/access-report.view.ts) — 280 lines
- [application-health.view.ts](../../models/view/application-health.view.ts) — 157 lines
- [risk-insights.ts](../../models/domain/risk-insights.ts) — 275 lines

### Documentation

- [standards.md](../../standards/standards.md) — Development standards
- [README.md](../README.md) — Project documentation

---

**Document Version:** 1.1
**Last Updated:** 2026-03-12
**Maintainer:** DIRT Team
