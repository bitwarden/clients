# CipherHealthService Integration Guide

## Overview

**What it replaces:** Direct usage of `PasswordHealthService` in report generation
**Why:** Provides unified health analysis with concurrency control, password reuse detection, and consistent result format

### Current Implementation Issues

The existing `PasswordHealthService`:

- No concurrency limiting on HIBP calls (can hit rate limits with large orgs)
- Separate methods return different types (`ExposedPasswordDetail[]`, `WeakPasswordDetail`)
- No password reuse detection across ciphers
- Results require separate processing for weak/exposed/reused detection

### New Implementation Benefits

`CipherHealthService`:

- ✅ **Concurrency-limited HIBP calls** (max 5 concurrent) prevents rate limiting
- ✅ **Unified result model** (`CipherHealthView`) with all health data
- ✅ **Password reuse detection** built-in
- ✅ **Map-based results** for O(1) lookups by cipher ID
- ✅ **Smart model methods** (`isAtRisk()`, `getPasswordStrengthLabel()`, `getPasswordStrengthBadgeVariant()`)
- ✅ **Platform-agnostic** (works in CLI and web)

---

## Key Architectural Changes

### OLD: Service Computes UI Labels

The old `PasswordHealthService` had presentation logic:

```typescript
// In PasswordHealthService
getPasswordScoreInfo(score: number): WeakPasswordScore {
  switch (score) {
    case 4: return { label: "strong", badgeVariant: "success" };
    case 3: return { label: "good", badgeVariant: "primary" };
    case 2: return { label: "weak", badgeVariant: "warning" };
    default: return { label: "veryWeak", badgeVariant: "danger" };
  }
}

findWeakPasswordDetails(cipher: CipherView): WeakPasswordDetail | null {
  const { score } = this.passwordStrengthService.getPasswordStrength(...);
  if (score != null && score <= 2) {
    return {
      score: score,
      detailValue: this.getPasswordScoreInfo(score)  // Service computes label/badge
    };
  }
  return null;
}
```

**Problem:** Domain service contains UI presentation logic.

### NEW: Model Provides Helper Methods (Smart Models)

The new architecture follows **"Smart Models, Thin Services"**:

**Service** (domain layer) only computes raw data:

```typescript
// In DefaultCipherHealthService
private getPasswordStrength(cipher: CipherView): number | undefined {
  const { score } = this.passwordStrengthService.getPasswordStrength(...);
  return score;  // Returns raw score (0-4), not labels
}

// Stores raw score in model
return new CipherHealthView({
  weakPasswordScore: score,  // Raw data only
  hasWeakPassword: score != null && score <= 2,
  // ...
});
```

**Model** (view layer) provides UI helper methods:

```typescript
// In CipherHealthView
getPasswordStrengthLabel(): string {
  switch (this.weakPasswordScore) {
    case 4: return "strong";
    case 3: return "good";
    case 2: return "weak";
    default: return "veryWeak";
  }
}

getPasswordStrengthBadgeVariant(): "success" | "primary" | "warning" | "danger" {
  switch (this.weakPasswordScore) {
    case 4: return "success";
    case 3: return "primary";
    case 2: return "warning";
    default: return "danger";
  }
}
```

**Benefits:**

- Domain service stays focused on business logic (computing scores)
- View model handles presentation concerns (labels, badges)
- Easier to test (service doesn't need to know about UI)
- UI components call model methods directly

### Usage in UI Components

**OLD way:**

```typescript
const weakDetail = passwordHealthService.findWeakPasswordDetails(cipher);
if (weakDetail) {
  const label = weakDetail.detailValue.label; // Service provided label
  const badge = weakDetail.detailValue.badgeVariant; // Service provided badge
}
```

**NEW way:**

```typescript
const health = healthMap.get(cipher.id);
if (health?.hasWeakPassword) {
  const label = health.getPasswordStrengthLabel(); // Model provides label
  const badge = health.getPasswordStrengthBadgeVariant(); // Model provides badge
  const score = health.weakPasswordScore; // Raw score available if needed
}
```

---

## DI Registration

### 1. Provider Setup

Add to `services/providers.ts`:

```typescript
import { safeProvider } from "@bitwarden/ui-common";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";

export const ACCESS_INTELLIGENCE_PROVIDERS = [
  // ... existing providers

  // Domain Services
  safeProvider({
    provide: CipherHealthService,
    useClass: DefaultCipherHealthService,
    deps: [AuditService, PasswordStrengthServiceAbstraction],
  }),
];
```

### 2. Module Registration

The providers are already registered in `AccessIntelligenceModule` via `ACCESS_INTELLIGENCE_PROVIDERS`.

---

## Service Migration

### Before: Using PasswordHealthService in RiskInsightsOrchestratorService

```typescript
import { PasswordHealthService } from "./password-health.service";
import { buildPasswordUseMap } from "../../helpers";

export class RiskInsightsOrchestratorService {
  constructor(private passwordHealthService: PasswordHealthService) {}

  private _getCipherHealth(
    ciphers: CipherView[],
    memberDetails: MemberDetails[],
  ): Observable<CipherHealthReport[]> {
    // Manual filtering of valid ciphers
    const validCiphers = ciphers.filter((c) => this.passwordHealthService.isValidCipher(c));

    // Manual password reuse detection (helper function)
    const passwordUseMap = buildPasswordUseMap(validCiphers);

    // Check for exposed passwords (no concurrency control)
    return this.passwordHealthService.auditPasswordLeaks$(validCiphers).pipe(
      map((exposedDetails) => {
        return validCiphers.map((cipher) => {
          // O(n) lookup for exposed details
          const exposedPasswordDetail = exposedDetails.find((x) => x?.cipherId === cipher.id);

          // Separate call for each cipher's weak password check
          const weakPasswordDetail = this.passwordHealthService.findWeakPasswordDetails(cipher);

          // Manual reuse lookup
          const reusedPasswordCount = passwordUseMap.get(cipher.login.password!) ?? 0;

          return {
            cipher,
            cipherMembers: memberDetails.filter((x) => x.cipherId === cipher.id),
            applications: getTrimmedCipherUris(cipher),
            healthData: {
              weakPasswordDetail,
              reusedPasswordCount,
              exposedPasswordDetail,
            },
          } as CipherHealthReport;
        });
      }),
    );
  }
}
```

### After: Using CipherHealthService in ReportGenerationService

```typescript
import { CipherHealthService } from "../abstractions/cipher-health.service";

export class ReportGenerationService {
  constructor(private cipherHealthService: CipherHealthService) {}

  private buildCipherHealthReports(
    ciphers: CipherView[],
    memberDetails: MemberDetails[],
  ): Observable<CipherHealthReport[]> {
    // Single call with concurrency control built-in
    return this.cipherHealthService.checkCipherHealth(ciphers).pipe(
      map((healthMap) => {
        // O(1) lookup by cipher ID
        return ciphers
          .map((cipher) => {
            const health = healthMap.get(cipher.id);
            if (!health) return null; // Invalid cipher (filtered by service)

            return {
              cipher,
              cipherMembers: memberDetails.filter((x) => x.cipherId === cipher.id),
              applications: getTrimmedCipherUris(cipher),
              health, // Single object with all health data
            } as CipherHealthReport;
          })
          .filter(Boolean);
      }),
    );
  }
}
```

---

## Integration Patterns

### Pattern 1: Report Generation Pipeline

```typescript
// ReportGenerationService - orchestrates report building
generateReport(orgId: OrganizationId): Observable<RiskInsightsView> {
  return forkJoin({
    ciphers: this.cipherService.getAllDecrypted(),
    members: this.organizationService.getMembers(orgId),
    collections: this.organizationService.getCollections(orgId),
  }).pipe(
    switchMap(({ ciphers, members, collections }) =>
      // Call CipherHealthService as part of generation pipeline
      this.cipherHealthService.checkCipherHealth(ciphers).pipe(
        map(healthMap => ({
          ciphers,
          members,
          collections,
          healthMap, // Pass to next step
        }))
      )
    ),
    map(({ ciphers, members, collections, healthMap }) => {
      // Build report using health data
      const applications = this.groupCiphersByApplication(ciphers, healthMap);
      const atRiskMembers = this.findAtRiskMembers(members, healthMap);
      const summary = this.buildSummary(healthMap);

      return new RiskInsightsView({ applications, atRiskMembers, summary });
    })
  );
}
```

### Pattern 2: Filtering At-Risk Items

```typescript
// ReportGenerationService - identifying at-risk applications
private groupCiphersByApplication(
  ciphers: CipherView[],
  healthMap: Map<string, CipherHealthView>
): ApplicationHealthReport[] {
  const appMap = new Map<string, CipherView[]>();

  // Group ciphers by hostname
  ciphers.forEach(cipher => {
    const hostname = this.extractHostname(cipher);
    if (!appMap.has(hostname)) {
      appMap.set(hostname, []);
    }
    appMap.get(hostname).push(cipher);
  });

  // Build application reports with health data
  return Array.from(appMap.entries()).map(([hostname, appCiphers]) => {
    const atRiskCount = appCiphers.filter(c =>
      healthMap.get(c.id)?.isAtRisk()
    ).length;

    return {
      hostname,
      totalCiphers: appCiphers.length,
      atRiskCiphers: atRiskCount,
      isAtRisk: atRiskCount > 0,
    };
  });
}
```

### Pattern 3: Summary Aggregation

```typescript
// ReportGenerationService - computing summary statistics
private buildSummary(
  healthMap: Map<string, CipherHealthView>
): RiskInsightsSummaryView {
  const allHealth = Array.from(healthMap.values());

  return new RiskInsightsSummaryView({
    totalPasswords: allHealth.length,
    weakPasswords: allHealth.filter(h => h.hasWeakPassword).length,
    reusedPasswords: allHealth.filter(h => h.hasReusedPassword).length,
    exposedPasswords: allHealth.filter(h => h.hasExposedPassword).length,
    atRiskPasswords: allHealth.filter(h => h.isAtRisk()).length,
  });
}
```

### Pattern 4: UI Component Usage (Label/Badge Display)

```typescript
// In an Angular component template
@Component({
  template: `
    <div *ngFor="let cipher of ciphers">
      <div class="password-health">
        <!-- Use model helper methods for UI display -->
        <span
          [class]="'badge-' + getHealthBadge(cipher.id)"
          [attr.aria-label]="getHealthLabel(cipher.id)"
        >
          {{ getHealthLabel(cipher.id) }}
        </span>

        <!-- Show exposure count if exposed -->
        <span *ngIf="isExposed(cipher.id)">
          Exposed {{ getExposedCount(cipher.id) }}x in data breaches
        </span>
      </div>
    </div>
  `,
})
export class PasswordHealthComponent {
  ciphers: CipherView[];
  healthMap: Map<string, CipherHealthView>;

  getHealthLabel(cipherId: string): string {
    const health = this.healthMap.get(cipherId);
    return health?.getPasswordStrengthLabel() ?? "unknown";
  }

  getHealthBadge(cipherId: string): string {
    const health = this.healthMap.get(cipherId);
    return health?.getPasswordStrengthBadgeVariant() ?? "warning";
  }

  isExposed(cipherId: string): boolean {
    return this.healthMap.get(cipherId)?.hasExposedPassword ?? false;
  }

  getExposedCount(cipherId: string): number {
    return this.healthMap.get(cipherId)?.exposedCount ?? 0;
  }
}
```

---

## Migration Checklist

### Phase 1: Service Setup

- [ ] Add `CipherHealthService` provider to `providers.ts`
- [ ] Verify DI registration compiles (`npm run build:bit-common`)
- [ ] Inject service in `ReportGenerationService` (constructor only, don't use yet)

### Phase 2: Parallel Implementation

- [ ] Add `CipherHealthService` alongside existing `PasswordHealthService`
- [ ] Update `ReportGenerationService` to call both services
- [ ] Compare results to verify correctness
- [ ] Log any discrepancies for investigation

### Phase 3: Component Migration

- [ ] Migrate `RiskInsightsOrchestratorService` to use `CipherHealthService`
- [ ] Update report building logic to use `CipherHealthView` model
- [ ] Test with small organization (< 100 ciphers)
- [ ] Test with large organization (1000+ ciphers) - verify concurrency control

### Phase 4: Cleanup

- [ ] Remove `PasswordHealthService` imports
- [ ] Remove `password-health.ts` model types (deprecated)
- [ ] Remove comparison/logging code
- [ ] Update tests to use `CipherHealthService`

---

## Testing

### Unit Tests

Unit tests are located at:

- [default-cipher-health.service.spec.ts](../../services/implementations/default-cipher-health.service.spec.ts)

The tests cover:

- Weak password detection and UI helper methods
- Exposed password detection with HIBP counts
- Strong password handling
- Password reuse detection across multiple ciphers
- Concurrent HIBP call limiting (max 5)
- Invalid cipher filtering
- Edge cases (no password, deleted ciphers, non-login types)

### Integration Testing Strategy

When migrating from `PasswordHealthService`, verify results match:

```typescript
// Compare weak password detection
const oldWeakCount = ciphers
  .map((c) => passwordHealthService.findWeakPasswordDetails(c))
  .filter(Boolean).length;

const healthMap = await firstValueFrom(cipherHealthService.checkCipherHealth(ciphers));
const newWeakCount = Array.from(healthMap.values()).filter((h) => h.hasWeakPassword).length;

expect(newWeakCount).toBe(oldWeakCount);
```

---

## Performance Considerations

### HIBP Rate Limiting

The service limits concurrent HIBP calls to **5** to avoid rate limiting:

```typescript
private readonly MAX_CONCURRENT_HIBP_CALLS = 5;
```

For large organizations:

- **100 ciphers**: ~20 seconds
- **500 ciphers**: ~2 minutes
- **1000 ciphers**: ~4 minutes

**Progress Reporting:**
If needed, add progress reporting to `checkCipherHealth`:

```typescript
checkCipherHealth(ciphers: CipherView[]): Observable<HealthCheckProgress> {
  let completed = 0;
  const total = ciphers.length;

  return from(ciphers).pipe(
    mergeMap(cipher =>
      this.checkSingleCipherHealthInternal(cipher).pipe(
        tap(() => {
          completed++;
          // Emit progress
          this.progress$.next({ completed, total, percentage: (completed / total) * 100 });
        })
      ),
      this.MAX_CONCURRENT_HIBP_CALLS
    ),
    toArray()
  );
}
```

### Memory Optimization

The service returns a `Map` (not array) for O(1) lookups:

```typescript
// ❌ Slow: O(n) lookup
const health = healthArray.find((h) => h.cipherId === cipherId);

// ✅ Fast: O(1) lookup
const health = healthMap.get(cipherId);
```

---

## Rollback Plan

If issues arise during migration:

### Step 1: Disable New Service

Comment out the service call and revert to old service:

```typescript
// Temporarily revert
// return this.cipherHealthService.checkCipherHealth(ciphers);
return this.passwordHealthService.auditPasswordLeaks$(ciphers);
```

### Step 2: Investigate Discrepancies

Compare results between old and new services:

```typescript
forkJoin({
  old: this.passwordHealthService.auditPasswordLeaks$(ciphers),
  new: this.cipherHealthService.checkCipherHealth(ciphers),
}).subscribe(({ old, new: newResults }) => {
  console.log("Old results:", old.length);
  console.log(
    "New results:",
    Array.from(newResults.values()).filter((h) => h.hasExposedPassword).length,
  );
});
```

### Step 3: File Issue

If results don't match, file issue with:

- Organization size
- Discrepancy details (which ciphers differ)
- Console logs from comparison

### Step 4: Remove Provider

If completely blocking, remove from `providers.ts`:

```typescript
// safeProvider({ provide: CipherHealthService, useClass: DefaultCipherHealthService, deps: [...] }),
```

---

## Common Issues

### Issue 1: "No provider for CipherHealthService"

**Cause:** Service not registered in DI
**Fix:** Ensure `ACCESS_INTELLIGENCE_PROVIDERS` is imported in module

### Issue 2: HIBP rate limiting errors

**Cause:** Concurrency limit too high
**Fix:** Reduce `MAX_CONCURRENT_HIBP_CALLS` (default: 5)

### Issue 3: Different results from PasswordHealthService

**Cause:** Username parsing differences
**Fix:** Compare `extractUsernameParts()` logic with old service

### Issue 4: Memory issues with large organizations

**Cause:** Storing too many health results in memory
**Fix:** Use streaming/pagination for very large organizations (5000+ ciphers)

---

## Related Documentation

- [CipherHealthService Abstract](../../../reports/risk-insights/services/abstractions/cipher-health.service.ts)
- [DefaultCipherHealthService Implementation](../../../reports/risk-insights/services/implementations/default-cipher-health.service.ts)
- [CipherHealthView Model](../../../reports/risk-insights/models/view/cipher-health.view.ts)
- [Service Dependency Graph](../architecture/service-dependency-graph.md)
- [Session Log](../sessions/2026-02-10-services-drawer-cipher-health.md)
