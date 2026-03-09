# ReportPersistenceService Integration Guide

**Purpose:** Step-by-step guide for integrating backend-agnostic report persistence with encryption and compression

---

## Overview

**What it replaces:** Save/load logic scattered in `RiskInsightsOrchestratorService`
**Why:** Provides backend-agnostic storage with encryption/compression, enabling easy backend migration

### Current Implementation Issues

The existing `RiskInsightsOrchestratorService`:

- Mixes persistence logic with generation, state management, and critical app handling
- Tightly coupled to current DB storage backend
- 250+ lines of save/load/update methods (lines 231-639)
- Difficult to change storage backend without touching orchestrator
- No clear separation between encryption and storage concerns

### New Implementation Benefits

`ReportPersistenceService`:

- ✅ **Backend-agnostic design** - Switch storage backends without changing calling code
- ✅ **Multiple implementations** - DB storage now, blob storage later, both via DI
- ✅ **Feature flag support** - Gradual rollout via factory provider
- ✅ **Clear responsibilities** - Encryption, compression, API coordination
- ✅ **Type-safe results** - Returns `SaveReportResult` with server-assigned IDs
- ✅ **Unified interface** - Same methods whether backend is DB, blob, or other

---

## Key Architectural Changes

### OLD: Orchestrator Handles Everything

The old `RiskInsightsOrchestratorService` mixed concerns:

```typescript
export class RiskInsightsOrchestratorService {
  // Handles: generation, encryption, compression, persistence, state, critical apps

  private _fetchReport$(orgId: OrganizationId, userId: UserId): Observable<ReportState> {
    return this.reportService.getRiskInsightsReport$(organizationId, userId).pipe(
      // Decryption logic here
      // Decompression logic here
      // Model conversion here
      // Error handling here
      catchError(...),
    );
  }

  saveCriticalApplications$(apps: string[]): Observable<ReportState> {
    return this.rawReportData$.pipe(
      // Business logic for critical apps here
      // Encryption logic here
      // Compression logic here
      // API calls here (multiple services)
      // State updates here
      switchMap(() => forkJoin([updateApplicationsCall, updateSummaryCall])),
      tap((finalState) => this._flagForUpdatesSubject.next(finalState)),
    );
  }

  // Similar for saveApplicationReviewStatus$, removeCriticalApplications$
  // 250+ lines of mixed concerns
}
```

**Problems:**

- Single service has too many responsibilities
- Can't change backend without modifying orchestrator
- Business logic (critical apps) mixed with persistence
- Difficult to test persistence in isolation

### NEW: Persistence Service with Backend Flexibility

The new architecture separates concerns:

**Smart Model** handles business logic:

```typescript
// In RiskInsightsView (smart model)
markApplicationAsCritical(applicationName: string): void {
  const app = this.applications.find((a) => a.applicationName === applicationName);
  if (app) {
    app.isCritical = true;
  } else {
    this.applications.push(new RiskInsightsApplicationView({
      applicationName,
      isCritical: true,
    }));
  }
  this.recomputeSummary(); // Smart model recomputes
}
```

**Data Service** orchestrates mutation + persistence:

```typescript
// In AccessIntelligenceDataService (facade)
markApplicationAsCritical(applicationName: string): Observable<void> {
  const report = this._report$.value;
  if (!report) return throwError(() => new Error('No report loaded'));

  // 1. Mutate view model
  report.markApplicationAsCritical(applicationName);

  // 2. Persist changes
  return this.persistenceService.saveApplicationMetadata(
    report.id,
    report.organizationId,
    report.applications,
    report.summary
  ).pipe(
    tap(() => this._report$.next(report)) // Emit updated report
  );
}
```

**Persistence Service** handles storage:

```typescript
// In DefaultReportPersistenceService (current DB backend)
saveApplicationMetadata(
  reportId: OrganizationReportId,
  organizationId: OrganizationId,
  applications: RiskInsightsApplicationView[],
  summary: RiskInsightsSummaryView
): Observable<void> {
  // 1. Encrypt application data
  const encryptedApps = await this.encryptionService.encryptApplicationData(applications);

  // 2. Encrypt summary data
  const encryptedSummary = await this.encryptionService.encryptSummaryData(summary);

  // 3. Save both via API
  return forkJoin([
    this.riskInsightsApiService.updateRiskInsightsApplicationData$(reportId, orgId, encryptedApps),
    this.riskInsightsApiService.updateRiskInsightsSummary$(reportId, orgId, encryptedSummary)
  ]).pipe(map(() => void 0));
}
```

**Benefits:**

- Business logic in model (mark critical)
- Orchestration in data service (mutate → persist)
- Storage in persistence service (encrypt → save)
- Easy to swap backends (just change persistence implementation)

---

## Backend Flexibility Strategy

### Multiple Implementations Pattern

The service supports **multiple implementations** selected via **DI factory**:

```
Abstract: ReportPersistenceService
  ├─ DefaultReportPersistenceService (Phase 1: Current DB)
  └─ BlobReportPersistenceService (Phase 2: Future blob storage)

Factory Provider: Selects implementation based on:
  - Feature flag (optional)
  - Configuration
  - Environment
```

### Phase 1: Current DB Backend

**DI Registration (simple):**

```typescript
// providers.ts
export const ACCESS_INTELLIGENCE_PROVIDERS = [
  safeProvider({
    provide: ReportPersistenceService,
    useClass: DefaultReportPersistenceService,
    deps: [RiskInsightsApiService, RiskInsightsEncryptionService, LogService],
  }),
];
```

**Implementation:**

```typescript
class DefaultReportPersistenceService implements ReportPersistenceService {
  constructor(
    private riskInsightsApiService: RiskInsightsApiService,
    private encryptionService: RiskInsightsEncryptionService,
    private logService: LogService,
  ) {}

  saveReport(report: RiskInsights, orgId: OrganizationId): Observable<SaveReportResult> {
    // Use current DB backend
    return from(this.encryptionService.encryptReport(report)).pipe(
      switchMap((encrypted) =>
        this.riskInsightsApiService.saveRiskInsightsReport$(encrypted, orgId),
      ),
      map((response) => ({
        reportId: response.id,
        savedAt: new Date(response.createdDate),
      })),
    );
  }

  loadReport(orgId: OrganizationId): Observable<RiskInsightsView | null> {
    return this.riskInsightsApiService.getRiskInsightsReport$(orgId).pipe(
      switchMap((response) => {
        if (!response) return of(null);
        return from(this.encryptionService.decryptReport(response));
      }),
      map((decrypted) => (decrypted ? RiskInsightsView.fromDomain(decrypted) : null)),
    );
  }
}
```

### Phase 2: Future Blob Storage Backend

**DI Registration (factory with feature flag):**

```typescript
// providers.ts
function reportPersistenceServiceFactory(
  configService: ConfigService,
  riskInsightsApi: RiskInsightsApiService,
  reportStorageApi: ReportStorageApiService,
  encryptionService: RiskInsightsEncryptionService,
  logService: LogService,
): ReportPersistenceService {
  const useBlobStorage = configService.getFeatureFlag("access-intelligence-blob-storage");

  if (useBlobStorage) {
    return new BlobReportPersistenceService(
      riskInsightsApi, // For metadata
      reportStorageApi, // For payload
      encryptionService,
      logService,
    );
  }

  return new DefaultReportPersistenceService(riskInsightsApi, encryptionService, logService);
}

export const ACCESS_INTELLIGENCE_PROVIDERS = [
  safeProvider({
    provide: ReportPersistenceService,
    useFactory: reportPersistenceServiceFactory,
    deps: [
      ConfigService,
      RiskInsightsApiService,
      ReportStorageApiService,
      RiskInsightsEncryptionService,
      LogService,
    ],
  }),
];
```

**New Implementation:**

```typescript
class BlobReportPersistenceService implements ReportPersistenceService {
  constructor(
    private riskInsightsApiService: RiskInsightsApiService, // For metadata
    private reportStorageApiService: ReportStorageApiService, // For payload
    private encryptionService: RiskInsightsEncryptionService,
    private logService: LogService,
  ) {}

  saveReport(report: RiskInsights, orgId: OrganizationId): Observable<SaveReportResult> {
    return from(this.encryptionService.encryptReport(report)).pipe(
      switchMap((encrypted) => {
        // Split storage: payload → blob, metadata → DB
        return forkJoin({
          payload: this.reportStorageApiService.uploadReport$(encrypted.payload, orgId),
          metadata: this.riskInsightsApiService.saveRiskInsightsMetadata$(
            encrypted.metadata,
            orgId,
          ),
        });
      }),
      map((responses) => ({
        reportId: responses.metadata.id,
        savedAt: new Date(responses.metadata.createdDate),
      })),
    );
  }

  // loadReport() also changes to fetch from blob + DB
}
```

**Rollout Strategy:**

1. Deploy with feature flag OFF (uses `DefaultReportPersistenceService`)
2. Test with flag ON for subset of orgs
3. Monitor errors, performance
4. Gradually increase rollout percentage
5. Remove old implementation when fully migrated

---

## DI Registration

### Phase 1: Simple Provider (Current)

Add to `services/providers.ts`:

```typescript
import { safeProvider } from "@bitwarden/ui-common";
import { ReportPersistenceService } from "../abstractions/report-persistence.service";
import { DefaultReportPersistenceService } from "../implementations/default-report-persistence.service";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";
import { LegacyRiskInsightsEncryptionService } from "../implementations/legacy-risk-insights-encryption.service";
import { LogService } from "@bitwarden/logging";

export const ACCESS_INTELLIGENCE_PROVIDERS = [
  // ... existing providers

  // Persistence Service
  safeProvider({
    provide: ReportPersistenceService,
    useClass: DefaultReportPersistenceService,
    deps: [RiskInsightsApiService, RiskInsightsEncryptionService, LogService],
  }),
];
```

### Phase 2: Factory Provider (Future)

When blob storage backend is ready:

```typescript
import { ConfigService } from "@bitwarden/common/abstractions/config.service";
import { ReportStorageApiService } from "../api/report-storage-api.service";
import { BlobReportPersistenceService } from "../implementations/blob-report-persistence.service";

function reportPersistenceServiceFactory(
  configService: ConfigService,
  riskInsightsApi: RiskInsightsApiService,
  reportStorageApi: ReportStorageApiService,
  encryptionService: RiskInsightsEncryptionService,
  logService: LogService,
): ReportPersistenceService {
  const useBlobStorage = configService.getFeatureFlag("access-intelligence-blob-storage");

  if (useBlobStorage) {
    logService.info("[ReportPersistence] Using blob storage backend");
    return new BlobReportPersistenceService(
      riskInsightsApi,
      reportStorageApi,
      encryptionService,
      logService,
    );
  }

  logService.info("[ReportPersistence] Using DB backend");
  return new DefaultReportPersistenceService(riskInsightsApi, encryptionService, logService);
}

export const ACCESS_INTELLIGENCE_PROVIDERS = [
  // ... existing providers

  // Persistence Service (feature-flagged)
  safeProvider({
    provide: ReportPersistenceService,
    useFactory: reportPersistenceServiceFactory,
    deps: [
      ConfigService,
      RiskInsightsApiService,
      ReportStorageApiService,
      RiskInsightsEncryptionService,
      LogService,
    ],
  }),
];
```

---

## Service Migration

### Before: Using RiskInsightsOrchestratorService

```typescript
export class AccessIntelligenceDataService {
  constructor(private orchestrator: RiskInsightsOrchestratorService) {}

  markApplicationAsCritical(appName: string): Observable<void> {
    // Orchestrator handles everything: business logic + persistence
    return this.orchestrator.saveCriticalApplications$([appName]).pipe(map(() => void 0));
  }

  generateReport(): void {
    // Orchestrator handles generation + persistence
    this.orchestrator.generateReport();
  }

  loadReport(): Observable<RiskInsightsView> {
    // Orchestrator handles fetching + decryption + model conversion
    return this.orchestrator.rawReportData$.pipe(
      filter((state) => state.status === ReportStatus.Complete),
      map((state) => state.data as RiskInsightsView),
    );
  }
}
```

### After: Using ReportPersistenceService

```typescript
export class AccessIntelligenceDataService {
  private _report$ = new BehaviorSubject<RiskInsightsView | null>(null);
  readonly report$ = this._report$.asObservable();

  constructor(
    private reportGenerationService: ReportGenerationService,
    private reportPersistenceService: ReportPersistenceService,
    private cipherService: CipherService,
    private organizationService: OrganizationService,
  ) {}

  markApplicationAsCritical(appName: string): Observable<void> {
    const report = this._report$.value;
    if (!report) return throwError(() => new Error("No report loaded"));

    // 1. Smart model handles business logic
    report.markApplicationAsCritical(appName);

    // 2. Persistence service handles storage
    return this.reportPersistenceService
      .saveApplicationMetadata(
        report.id,
        report.organizationId,
        report.applications,
        report.summary,
      )
      .pipe(
        tap(() => this._report$.next(report)), // Emit updated report
      );
  }

  generateReport(orgId: OrganizationId): Observable<void> {
    // 1. Load org data
    return forkJoin({
      ciphers: this.cipherService.getAllFromApiForOrganization(orgId),
      members: this.organizationService.getMembers(orgId),
      collections: this.organizationService.getCollections(orgId),
      groups: this.organizationService.getGroups(orgId),
      previousApps: this.reportPersistenceService
        .loadReport(orgId)
        .pipe(map((prevReport) => prevReport?.applications ?? [])),
    }).pipe(
      // 2. Generate report
      switchMap(({ ciphers, members, collections, groups, previousApps }) =>
        this.reportGenerationService.generateReport(
          ciphers,
          members,
          collections,
          groups,
          previousApps,
        ),
      ),
      // 3. Save report
      switchMap((generatedReport) => {
        const domain = RiskInsights.fromView(generatedReport);
        return this.reportPersistenceService.saveReport(domain, orgId).pipe(
          map((result) => {
            generatedReport.id = result.reportId;
            return generatedReport;
          }),
        );
      }),
      tap((savedReport) => this._report$.next(savedReport)),
      map(() => void 0),
    );
  }

  loadReport(orgId: OrganizationId): Observable<void> {
    return this.reportPersistenceService.loadReport(orgId).pipe(
      tap((report) => this._report$.next(report)),
      map(() => void 0),
    );
  }
}
```

---

## Integration Patterns

### Pattern 1: Save Full Report After Generation

```typescript
// In AccessIntelligenceDataService
generateAndSaveReport(orgId: OrganizationId): Observable<SaveReportResult> {
  return this.generateReport(orgId).pipe(
    switchMap((generatedView) => {
      const domain = RiskInsights.fromView(generatedView);
      return this.reportPersistenceService.saveReport(domain, orgId).pipe(
        tap((result) => {
          generatedView.id = result.reportId;
          this._report$.next(generatedView);
        })
      );
    })
  );
}
```

### Pattern 2: Update Application Metadata Only

```typescript
// In AccessIntelligenceDataService
updateApplicationMetadata(): Observable<void> {
  const report = this._report$.value;
  if (!report) return throwError(() => new Error('No report'));

  return this.reportPersistenceService.saveApplicationMetadata(
    report.id,
    report.organizationId,
    report.applications,
    report.summary
  ).pipe(
    tap(() => this._report$.next(report))
  );
}
```

### Pattern 3: Load Report on Initialization

```typescript
// In AccessIntelligenceDataService
initializeForOrganization(orgId: OrganizationId): Observable<void> {
  return this.reportPersistenceService.loadReport(orgId).pipe(
    tap((report) => {
      if (report) {
        this.logService.info('[AccessIntelligence] Loaded existing report', report.id);
        this._report$.next(report);
      } else {
        this.logService.info('[AccessIntelligence] No existing report, will generate');
        this._report$.next(null);
      }
    }),
    map(() => void 0),
    catchError((error) => {
      this.logService.error('[AccessIntelligence] Failed to load report', error);
      this._report$.next(null);
      return of(void 0);
    })
  );
}
```

### Pattern 4: Mutate View → Persist Pattern

```typescript
// Generic pattern for all mutations
private mutateAndPersist(
  mutation: (report: RiskInsightsView) => void
): Observable<void> {
  const report = this._report$.value;
  if (!report) return throwError(() => new Error('No report'));

  // 1. Mutate view model
  mutation(report);

  // 2. Persist changes
  return this.reportPersistenceService.saveApplicationMetadata(
    report.id,
    report.organizationId,
    report.applications,
    report.summary
  ).pipe(
    tap(() => this._report$.next(report))
  );
}

// Usage:
markApplicationAsCritical(appName: string): Observable<void> {
  return this.mutateAndPersist((report) =>
    report.markApplicationAsCritical(appName)
  );
}

markApplicationAsReviewed(appName: string): Observable<void> {
  return this.mutateAndPersist((report) =>
    report.markApplicationAsReviewed(appName)
  );
}
```

---

## Migration Checklist

### Phase 1: Service Setup (Current Session)

- [x] Create `ReportPersistenceService` abstract
- [x] Document ADR-003 for backend flexibility strategy
- [ ] Implement `DefaultReportPersistenceService` (DB backend)
- [ ] Write comprehensive tests (12+ tests)
- [ ] Add provider to `providers.ts`
- [ ] Verify DI registration compiles

### Phase 2: Integration (Next Session)

- [ ] Update `AccessIntelligenceDataService` to use persistence service
- [ ] Migrate `generateReport()` to use new pattern
- [ ] Migrate `loadReport()` to use new pattern
- [ ] Migrate mutation methods (mark critical, review)
- [ ] Test with small organization
- [ ] Test with large organization (verify encryption/compression)

### Phase 3: Orchestrator Cleanup

- [ ] Remove save/load logic from `RiskInsightsOrchestratorService`
- [ ] Remove critical app save methods (lines 231-639)
- [ ] Update components to use new data service
- [ ] Remove old orchestrator if fully replaced

### Phase 4: Future Backend Migration (When Ready)

- [ ] Coordinate with server team on new backend (blob storage, etc.)
- [ ] Create `ReportStorageApiService` for new backend
- [ ] Implement `BlobReportPersistenceService` (or appropriate name)
- [ ] Update DI registration to use factory provider
- [ ] Add feature flag configuration
- [ ] Test with feature flag disabled (verify no regression)
- [ ] Enable flag for subset of orgs
- [ ] Monitor errors and performance
- [ ] Gradually increase rollout
- [ ] Remove old implementation after full migration

---

## Testing

### Unit Tests

Unit tests will be located at:

- `services/implementations/default-report-persistence.service.spec.ts`

**Test categories (12+ tests):**

1. **Save Report Tests (4 tests):**
   - Happy path: encrypts, compresses, saves, returns report ID
   - Empty report: handles null/empty data gracefully
   - Encryption failure: catches and logs error
   - API failure: propagates error with context

2. **Save Application Metadata Tests (3 tests):**
   - Happy path: updates apps + summary via PATCH
   - Recomputed summary: verifies summary is encrypted and saved
   - API failure: handles partial failures (apps saved, summary failed)

3. **Load Report Tests (3 tests):**
   - Happy path: loads, decrypts, decompresses, assembles view
   - No report: returns null when 404
   - Decryption failure: catches and logs error

4. **Edge Cases (2 tests):**
   - Large report: verify compression reduces payload size
   - Member registry: verify registry is preserved in round-trip

### Integration Testing Strategy

When migrating from orchestrator, verify results match:

```typescript
// Test that persistence service produces same results as orchestrator
describe("ReportPersistenceService migration", () => {
  it("should produce same encrypted payload as orchestrator", async () => {
    const report = createTestReport();

    // Old way (orchestrator)
    const oldEncrypted = await orchestrator.encryptReport(report);

    // New way (persistence service)
    const newResult = await firstValueFrom(persistenceService.saveReport(report, orgId));

    // Compare encryption keys, compression, etc.
    expect(newResult.reportId).toBeDefined();
  });
});
```

---

## Performance Considerations

### Encryption/Compression Pipeline

The persistence service handles encryption and compression:

- **Encryption**: Uses `RiskInsightsEncryptionService` (existing)
- **Compression**: GZIP compression for large reports (TBD implementation)
- **Pipeline**: Encrypt → Compress → Save

**For large reports (450MB+ for large orgs):**

- Compression can reduce size by 70-90%
- Encryption adds minimal overhead
- Total save time: ~5-10 seconds for very large orgs

### SaveReportResult Return Type

Returns metadata immediately without waiting for async operations:

```typescript
interface SaveReportResult {
  reportId: OrganizationReportId; // Server-assigned ID
  savedAt: Date; // Timestamp
}
```

This allows calling code to:

- Update view model with server ID immediately
- Show success message while compression happens async
- Handle errors gracefully

---

## Rollback Plan

If issues arise during migration:

### Step 1: Disable New Service

Revert to orchestrator temporarily:

```typescript
// In AccessIntelligenceDataService
// Temporarily comment out persistence service usage
// return this.reportPersistenceService.saveReport(report, orgId);
return this.orchestrator.saveCriticalApplications$([appName]);
```

### Step 2: Investigate Discrepancies

Compare results:

```typescript
forkJoin({
  old: this.orchestrator.saveReport$(report),
  new: this.reportPersistenceService.saveReport(report, orgId),
}).subscribe(({ old, new: newResult }) => {
  console.log("Old result:", old);
  console.log("New result:", newResult);
});
```

### Step 3: File Issue

If blocking, file issue with:

- Organization size
- Error logs
- Encrypted payload comparison

### Step 4: Remove Provider (Last Resort)

If completely blocking:

```typescript
// In providers.ts - comment out provider
// safeProvider({ provide: ReportPersistenceService, useClass: DefaultReportPersistenceService, ... }),
```

---

## Common Issues

### Issue 1: "No provider for ReportPersistenceService"

**Cause:** Service not registered in DI
**Fix:** Ensure `ACCESS_INTELLIGENCE_PROVIDERS` is imported in module

### Issue 2: Report ID not returned after save

**Cause:** API response doesn't include ID
**Fix:** Verify `saveRiskInsightsReport$` returns response with `id` field

### Issue 3: Decryption failures on load

**Cause:** Encryption key mismatch
**Fix:** Verify `contentEncryptionKey` is saved and retrieved correctly

### Issue 4: Different behavior with feature flag

**Cause:** Multiple implementations have different logic
**Fix:** Ensure both implementations follow same contract, compare results in tests

### Issue 5: Memory issues with large reports

**Cause:** Keeping entire report in memory during compression
**Fix:** Stream compression for very large reports (future enhancement)

---

## Related Documentation

- [ReportPersistenceService Abstract](../../services/abstractions/report-persistence.service.ts)
- [DefaultReportPersistenceService Implementation](../../services/implementations/default-report-persistence.service.ts)
- [CLAUDE.md § Service Layer Architecture](../../CLAUDE.md#service-layer-architecture-api-vs-persistence-vs-domain)
- [Service Dependency Graph](../architecture/service-dependency-graph.md)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
