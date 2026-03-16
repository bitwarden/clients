# Domain vs. View Boundary Analysis — Access Intelligence Architecture

**Purpose:** Documents why AccessIntelligenceDataService intentionally deviates from the Cipher
pattern by storing View models rather than Domain models, and the justification for that decision

**Status:** Decision accepted — deviation is the current implemented architecture

---

## Executive Summary

**Finding:** Access Intelligence architecture **partially deviates** from the Cipher pattern for **valid reasons**, but this creates architectural inconsistency that should be documented and potentially reconsidered.

**Current State:**

- ✅ `ReportPersistenceService` correctly uses Domain models internally
- ❌ `AccessIntelligenceDataService` stores **View** models instead of **Domain** models
- ⚠️ This differs from `CipherService` which stores **encrypted Domain** and exposes **decrypted View**

---

## The Cipher Pattern (Canonical Reference)

### How CipherService Works

```typescript
// libs/common/src/vault/services/cipher.service.ts

// 1. Stores ENCRYPTED domain models (Cipher)
ciphers$(userId: UserId): Observable<Record<CipherId, CipherData>> {
  return this.encryptedCiphersState(userId).state$.pipe(
    map((ciphers) => ciphers ?? {})
  );
}

// 2. Exposes DECRYPTED view models (CipherView) - computed on demand
cipherViews$(userId: UserId): Observable<CipherView[] | null> {
  return combineLatest([
    this.encryptedCiphersState(userId).state$,  // ← Encrypted Domain!
    this.localData$(userId),
    this.keyService.cipherDecryptionKeys$(userId),
  ]).pipe(
    filter(([ciphers, _, keys]) => ciphers != null && keys != null),
    switchMap(() => this.getAllDecrypted(userId)),  // ← Decrypt on demand!
  );
}
```

### Key Principles

1. **Services store encrypted Domain models** (Cipher with EncString fields)
2. **Services expose decrypted View models** via computed observables
3. **Decryption happens on demand** when observables are subscribed to
4. **No decrypted data in service state** - only in observable streams

### Domain Model Characteristics (Cipher)

```typescript
export class Cipher extends Domain {
  name: EncString = new EncString(""); // ← Encrypted!
  notes?: EncString; // ← Encrypted!

  // Decrypts to View
  async decrypt(key): Promise<CipherView> {
    /* ... */
  }

  // Converts to serializable Data
  toCipherData(): CipherData {
    /* ... */
  }
}
```

---

## Current Access Intelligence Architecture

### ReportPersistenceService (CORRECT ✅)

**Follows Domain pattern correctly:**

```typescript
// bitwarden_license/bit-common/src/dirt/reports/risk-insights/services/
//   implementations/default-report-persistence.service.ts

saveReport$(view: AccessReportView, orgId): Observable<OrganizationReportId> {
  // View → Domain (encrypt) → Data → API
  return from(
    AccessReport.fromView(view, encryptionService, context)  // ← Encrypt!
  ).pipe(
    switchMap((domain) => {
      const data = domain.toData();  // ← Domain → Data
      return this.apiService.save(data);
    })
  );
}

loadReport$(orgId): Observable<AccessReportView | null> {
  // API → Data → Domain → View (decrypt)
  return this.apiService.get(orgId).pipe(
    switchMap((apiResponse) => {
      const data = new AccessReportData(apiResponse);
      const domain = new AccessReport(data);  // ← Data → Domain
      return from(domain.decrypt(encryptionService, context));  // ← Decrypt!
    })
  );
}
```

**This follows the 4-layer architecture perfectly:**

- `Api → Data → Domain → View` (read flow)
- `View → Domain → Data → Api` (write flow)

### AccessIntelligenceDataService (INCONSISTENT ⚠️)

**Stores View instead of Domain:**

```typescript
// bitwarden_license/bit-common/src/dirt/reports/risk-insights/services/
//   implementations/default-access-intelligence-data.service.ts

export class DefaultAccessIntelligenceDataService {
  // ❌ Stores DECRYPTED View model
  private _report = new BehaviorSubject<AccessReportView | null>(null);
  readonly report$ = this._report.asObservable();

  initializeForOrganization$(orgId: OrganizationId): Observable<void> {
    return this.reportPersistenceService.loadReport$(orgId).pipe(
      tap((v2Report) => {
        this._report.next(v2Report); // ← Stores View directly!
      }),
    );
  }
}
```

**Cipher pattern would be:**

```typescript
export class DefaultAccessIntelligenceDataService {
  // ✅ Store ENCRYPTED Domain model
  private _report = new BehaviorSubject<AccessReport | null>(null);

  // ✅ Expose DECRYPTED View model (computed)
  readonly report$ = combineLatest([this._report.asObservable(), this.encryptionKeys$]).pipe(
    switchMap(([domain, keys]) => {
      if (!domain) return of(null);
      return from(domain.decrypt(encryptionService, context));
    }),
  );
}
```

---

## Why the Deviation Might Be Justified

### Differences Between Cipher and RiskInsights

| Aspect               | Cipher                            | RiskInsights                        |
| -------------------- | --------------------------------- | ----------------------------------- |
| **Quantity**         | Thousands per user                | One per organization                |
| **Encryption Key**   | User key (stable)                 | Content encryption key (per-report) |
| **Memory Cost**      | High (decrypt on demand)          | Low (single report)                 |
| **Access Pattern**   | Frequent re-decryption            | Load once, use many times           |
| **Key Availability** | Always available (user logged in) | Stored with report                  |

### Arguments FOR Storing View

1. **Performance:** Report is large (450MB+), decrypting on every subscription is wasteful
2. **Single Report:** Unlike Ciphers (thousands), we only have ONE report in memory
3. **Key Lifecycle:** `contentEncryptionKey` is stored with the report, not separately
4. **Simplicity:** No need to manage separate encryption key observables
5. **Already Decrypted:** Report is decrypted once when loaded, keeping it decrypted is pragmatic

### Arguments AGAINST Storing View (Architectural Consistency)

1. **Inconsistency:** Violates established Bitwarden pattern (Cipher/CipherView)
2. **Security:** Decrypted data in memory longer than necessary
3. **Principle Violation:** Services should store Domain, expose View
4. **Future Complexity:** May complicate adding features like field-level encryption
5. **Documentation Burden:** Need to explain why we're different

---

## Recommendation

### Option 1: Accept Deviation (Pragmatic) ⭐ RECOMMENDED

**Keep current architecture** but **document the decision clearly.**

**Rationale:**

- Performance benefits are real for large reports
- Single report vs. thousands of ciphers is a meaningful difference
- Current implementation is working well
- Re-architecting would add complexity without clear benefit

**Required Actions:**

1. ✅ Document this decision in an ADR (Architecture Decision Record)
2. ✅ Add clear comments in `AccessIntelligenceDataService` explaining deviation
3. ✅ Update CLAUDE.md to note this architectural exception
4. ⚠️ Monitor for security review feedback

**Code Comment Example:**

```typescript
export class DefaultAccessIntelligenceDataService {
  /**
   * Stores the decrypted report view in memory.
   *
   * ARCHITECTURAL NOTE: Unlike CipherService which stores encrypted Domain models,
   * we store the decrypted View for performance reasons:
   * 1. Single report per org (not thousands like Ciphers)
   * 2. Report is large (450MB+) - re-decrypting on every subscription is wasteful
   * 3. Content encryption key is stored with the report
   *
   * See: docs/access-intelligence/architecture/domain-view-boundary-analysis.md
   */
  private _report = new BehaviorSubject<AccessReportView | null>(null);
  readonly report$ = this._report.asObservable();
}
```

### Option 2: Align with Cipher Pattern (Architecturally Pure)

**Refactor to store Domain models.**

**Changes Required:**

1. Store `BehaviorSubject<AccessReport | null>` instead of View
2. Compute `report$` observable that decrypts on demand
3. Manage `contentEncryptionKey` separately (or extract from Domain)
4. Update all service methods to work with Domain

**Example Implementation:**

```typescript
export class DefaultAccessIntelligenceDataService {
  private _encryptedReport = new BehaviorSubject<AccessReport | null>(null);
  private _encryptionContext = new BehaviorSubject<EncryptionContext | null>(null);

  readonly report$ = combineLatest([
    this._encryptedReport.asObservable(),
    this._encryptionContext.asObservable(),
  ]).pipe(
    switchMap(([domain, context]) => {
      if (!domain || !context) return of(null);
      return from(domain.decrypt(this.encryptionService, context));
    }),
    shareReplay({ bufferSize: 1, refCount: true }), // Cache decryption
  );
}
```

**Tradeoffs:**

- ✅ Architecturally consistent with Cipher
- ✅ Follows Domain-driven design principles
- ❌ More complex code
- ❌ Potential performance cost (though `shareReplay` mitigates)
- ❌ Risk of introducing bugs during refactor

---

## Related Patterns in Codebase

### ✅ Correct Pattern Examples

1. **CipherService** - Stores Domain (Cipher), exposes View (CipherView)
2. **FolderService** - Stores Domain (Folder), exposes View (FolderView)
3. **CollectionService** - Stores Domain (Collection), exposes View (CollectionView)

### ⚠️ Other Deviations (if any)

_TODO: Survey codebase for other services that store View models_

---

## Action Items

### Immediate (Option 1 accepted — deviation is now the implemented architecture)

- [ ] Create ADR documenting this architectural decision — **still pending**
- [ ] Add inline comments to `AccessIntelligenceDataService` explaining deviation — verify in code
- [x] Update `CLAUDE.md` with this pattern exception — domain-view boundary noted in `dirt/CLAUDE.md`
- [ ] Add this document reference to getting-started.md

### Future Considerations

- [ ] Monitor for security team feedback on storing decrypted data
- [ ] Re-evaluate if moving to field-level encryption (envelope approach)
- [ ] Consider if other large, single-instance encrypted models should follow this pattern

---

## References

- **Cipher Pattern:** `libs/common/src/vault/models/domain/cipher.ts` (lines 127-221, decrypt method)
- **CipherService:** `libs/common/src/vault/services/cipher.service.ts` (lines 142-218)
- **4-Layer Architecture:** `bitwarden_license/bit-common/src/dirt/CLAUDE.md` (lines 56-224)
- **Domain Models:** `bitwarden_license/bit-common/src/dirt/access-intelligence/models/domain/access-report.ts`
- **Data Service:** `bitwarden_license/bit-common/src/dirt/access-intelligence/services/implementations/view/default-access-intelligence-data.service.ts`
- **Persistence Service:** `bitwarden_license/bit-common/src/dirt/access-intelligence/services/implementations/persistence/default-report-persistence.service.ts`

---

**Conclusion:**

While Access Intelligence **does deviate** from the Cipher pattern by storing View models in the data service, this deviation is **justified by the unique characteristics** of the domain (single large report vs. thousands of small ciphers). The **ReportPersistenceService correctly follows the Domain pattern**, so the architecture is sound at the storage boundary.

**Recommendation:** Document this as an intentional architectural decision rather than refactoring to match Cipher pattern exactly.

---

**Document Version:** 1.1
**Last Updated:** 2026-03-12
**Maintainer:** DIRT Team
