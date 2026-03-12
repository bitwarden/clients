# RxJS Standards

**Purpose:** Standards for RxJS patterns, Observable error handling, and common import paths for reactive programming in Access Intelligence development

---

## Table of Contents

1. [RxJS Patterns and Best Practices](#rxjs-patterns-and-best-practices)
   - [Observable Error Handling](#observable-error-handling)
   - [catchError Parameter Typing](#catcherror-parameter-typing)
   - [getUserId Pattern](#getuserid-pattern)
   - [firstValueFrom Pattern](#firstvaluefrom-pattern)
2. [Common Import Paths](#common-import-paths)
   - [Auth & Account](#auth--account)
   - [Types (GUIDs and Tagged Types)](#types-guids-and-tagged-types)
   - [Crypto & Encryption](#crypto--encryption)
   - [Test Utilities](#test-utilities)
   - [RxJS](#rxjs)
   - [Quick Reference Table](#quick-reference-table)

---

## RxJS Patterns and Best Practices

### Observable Error Handling

**Rule:** Methods returning Observables MUST use `throwError()` for errors, not synchronous throws.

```typescript
import { throwError } from "rxjs";

// ✅ CORRECT - Use throwError() for Observable errors
saveReport$(report: RiskInsights, organizationId: OrganizationId): Observable<OrganizationReportId> {
  if (!report.contentEncryptionKey) {
    return throwError(() => new Error("Report encryption key not found"));
  }
  return this.apiService.saveRiskInsightsReport$(requestPayload, organizationId);
}

// ❌ WRONG - Synchronous throw breaks Observable chain
saveReport(report: RiskInsights, organizationId: OrganizationId): Observable<OrganizationReportId> {
  if (!report.contentEncryptionKey) {
    throw new Error("Report encryption key not found"); // Won't work with .rejects.toThrow()
  }
  return this.apiService.saveRiskInsightsReport$(requestPayload, organizationId);
}
```

**Why:**

- Observable tests use `.rejects.toThrow()` which only catches errors emitted through the Observable stream
- Synchronous throws occur before Observable creation and won't be caught by subscribers
- Consistent error handling throughout the Observable pipeline
- Allows proper cleanup and error recovery in RxJS operators

**Error Inside Observable Pipeline:**

```typescript
// Within switchMap/map/etc, synchronous throws work fine
loadReport$(organizationId: OrganizationId): Observable<RiskInsightsView> {
  return this.apiService.getRiskInsightsReport$(organizationId).pipe(
    switchMap((apiResponse) => {
      if (!apiResponse) {
        return of(null);
      }

      // ✅ CORRECT - Inside operator, synchronous throw works
      if (!apiResponse.contentEncryptionKey) {
        throw new Error("Report encryption key not found");
      }

      return from(domain.decrypt(...));
    })
  );
}
```

### catchError Parameter Typing

**Rule:** `catchError` callback parameters MUST be typed as `unknown`. An untyped `(error)` parameter triggers the `rxjs/no-implicit-any-catch` ESLint rule and **fails the pre-commit hook**.

```typescript
// ✅ CORRECT - Explicit unknown type
pipe(
  catchError((error: unknown) => {
    this.logService.error("Operation failed", error);
    return throwError(() => error);
  }),
);

// ❌ WRONG - Implicit any fails pre-commit
pipe(
  catchError((error) => {
    // ← Missing ': unknown' → pre-commit failure
    this.logService.error("Operation failed", error);
    return throwError(() => error);
  }),
);
```

**Why:** TypeScript cannot know the type of a thrown error at compile time. `unknown` forces explicit narrowing before use and is the correct type annotation here. The `rxjs/no-implicit-any-catch` lint rule enforces this — it mirrors the TypeScript `useUnknownInCatchVariables` behavior for RxJS callbacks.

---

### getUserId Pattern

**Pattern:** Getting user ID from AccountService

```typescript
import { getUserId } from "@bitwarden/common/auth/services/account.service";

// ✅ CORRECT - getUserId takes Observable<Account>
loadReport$(organizationId: OrganizationId): Observable<RiskInsightsView> {
  return from(firstValueFrom(getUserId(this.accountService.activeAccount$))).pipe(
    switchMap((userId) => {
      if (!userId) {
        throw new Error("User ID not found");
      }
      // Use userId...
    })
  );
}

// ❌ WRONG - getUserId doesn't take unwrapped Account
const account = await firstValueFrom(this.accountService.activeAccount$);
const userId = getUserId(account); // Type error!
```

**Important Notes:**

- `getUserId` is an RxJS operator that expects `Observable<Account>`
- It throws "Null or undefined account" when account is null (not "User ID not found")
- Always wrap in `from(firstValueFrom(...))` to convert Promise back to Observable

**Error Message Reference:**

```typescript
// getUserId throws this error when account is null:
"Null or undefined account";

// Your service logic can throw this when userId is falsy:
"User ID not found";
```

### firstValueFrom Pattern

**Pattern:** Converting cold Observables to Promises for easier composition

```typescript
// ✅ CORRECT - Get userId then use in Observable chain
return from(firstValueFrom(getUserId(this.accountService.activeAccount$))).pipe(
  switchMap((userId) => {
    // Now we have userId as a value, not Observable
    return this.apiService.getData$(organizationId, userId);
  }),
);

// ❌ WRONG - Nesting Observables
return getUserId(this.accountService.activeAccount$).pipe(
  switchMap((userId) => {
    return this.apiService
      .getData$(organizationId, userId)
      .pipe
      // Nested pipes get messy fast
      ();
  }),
);
```

**When to use:**

- Converting single-value Observables to Promises for cleaner async/await
- Getting values from Observables to pass to other services
- Simplifying complex Observable chains

---

## Common Import Paths

Quick reference for frequently used imports. Always use these exact paths to avoid import errors.

### Auth & Account

```typescript
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
```

**Common mistake:** Importing `Account` from `@bitwarden/common/models/domain/account` (old path, no longer exists)

### Types (GUIDs and Tagged Types)

```typescript
import {
  CipherId,
  CollectionId,
  OrganizationId,
  OrganizationReportId,
  UserId,
} from "@bitwarden/common/types/guid";
```

**Note:** These are Tagged types (branded strings), use type assertions in tests:

```typescript
const userId = "user-123" as UserId;
const cipherId = "cipher-456" as CipherId;
```

### Crypto & Encryption

```typescript
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
```

### Test Utilities

```typescript
import {
  makeEncString,
  makeStaticByteArray,
  makeSymmetricCryptoKey,
  GetUniqueString,
} from "@bitwarden/common/spec";
```

**See:** [testing-standards-services.md](./testing-standards-services.md) for detailed usage of test utilities.

### RxJS

```typescript
import { Observable, BehaviorSubject, Subject, firstValueFrom, throwError } from "rxjs";
import { map, switchMap, tap, catchError, shareReplay } from "rxjs";
```

**Note:** Operators are imported from `"rxjs"` directly in modern RxJS, not `"rxjs/operators"`.

### Quick Reference Table

| Type                        | Import Path                                                     | Common Aliases          |
| --------------------------- | --------------------------------------------------------------- | ----------------------- |
| `Account`, `AccountService` | `@bitwarden/common/auth/abstractions/account.service`           | -                       |
| `getUserId`                 | `@bitwarden/common/auth/services/account.service`               | -                       |
| `CipherId`, `UserId`, etc.  | `@bitwarden/common/types/guid`                                  | Tagged types            |
| `EncString`                 | `@bitwarden/common/key-management/crypto/models/enc-string`     | -                       |
| `SymmetricCryptoKey`        | `@bitwarden/common/platform/models/domain/symmetric-crypto-key` | -                       |
| Test utilities              | `@bitwarden/common/spec`                                        | `makeEncString`, etc.   |
| RxJS core                   | `rxjs`                                                          | `Observable`, operators |

---

## Related Documentation

**Standards:**

- [Service Standards](./service-standards.md) - Service patterns using Observables
- [Angular Standards](./angular-standards.md) - Observable vs Signal usage in components
- [Code Organization Standards](./code-organization-standards.md) - Observable naming conventions
- [Testing Standards - Services](./testing-standards-services.md) - Testing Observable-based services

**Navigation:**

- [Standards Hub](./README.md) - All DIRT team standards

---

**Document Version:** 1.2
**Last Updated:** 2026-03-04
**Maintainer:** DIRT Team
