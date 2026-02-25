# AccountBillingCache Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate redundant `getSubscription()` API calls across the billing navigation chain and fix subscription menu visibility/routing logic.

**Architecture:** New `AccountBillingCache` service using read-through Observable caching (matching `OrganizationWarningsService` pattern), provided at `UserLayoutComponent` level so all child billing routes share one cache instance. Menu visibility and route target derived from two boolean rules.

**Tech Stack:** Angular 19, RxJS, Jest + jest-mock-extended

**Design doc:** `docs/plans/2026-02-25-account-billing-cache-design.md`

---

### Task 1: Create `AccountBillingCache` service

**Files:**

- Create: `apps/web/src/app/billing/services/account-billing-cache.service.ts`
- Modify: `apps/web/src/app/billing/services/index.ts`

**Step 1: Create the service**

```typescript
// apps/web/src/app/billing/services/account-billing-cache.service.ts
import { Injectable } from "@angular/core";
import { from, Observable, of } from "rxjs";

import { Maybe } from "@bitwarden/pricing";
import { BitwardenSubscription } from "@bitwarden/subscription";
import { AccountBillingClient } from "@bitwarden/web-vault/app/billing/clients";

@Injectable()
export class AccountBillingCache {
  private cache$: Observable<Maybe<BitwardenSubscription>> | null = null;

  constructor(private accountBillingClient: AccountBillingClient) {}

  getSubscription$ = (bypassCache = false): Observable<Maybe<BitwardenSubscription>> => {
    if (this.cache$ && !bypassCache) {
      return this.cache$;
    }
    this.cache$ = from(this.accountBillingClient.getSubscription());
    return this.cache$;
  };

  refresh = () => {
    this.cache$ = null;
  };
}
```

**Step 2: Add barrel export**

Add to `apps/web/src/app/billing/services/index.ts`:

```typescript
export * from "./account-billing-cache.service";
```

**Step 3: Commit**

```
feat(billing): add AccountBillingCache service with read-through caching
```

---

### Task 2: Write tests for `AccountBillingCache`

**Files:**

- Create: `apps/web/src/app/billing/services/account-billing-cache.service.spec.ts`

**Reference pattern:** `apps/web/src/app/billing/organizations/warnings/services/organization-warnings.service.spec.ts`

**Step 1: Write tests**

```typescript
// apps/web/src/app/billing/services/account-billing-cache.service.spec.ts
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { BitwardenSubscription } from "@bitwarden/subscription";
import { AccountBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { AccountBillingCache } from "./account-billing-cache.service";

describe("AccountBillingCache", () => {
  let service: AccountBillingCache;
  let accountBillingClient: MockProxy<AccountBillingClient>;

  const mockSubscription = {
    status: "active",
    cart: { passwordManager: {} },
    storage: { available: 1, readableUsed: "0 GB", used: 0 },
    nextCharge: new Date(),
  } as unknown as BitwardenSubscription;

  beforeEach(() => {
    accountBillingClient = mock<AccountBillingClient>();

    TestBed.configureTestingModule({
      providers: [
        AccountBillingCache,
        { provide: AccountBillingClient, useValue: accountBillingClient },
      ],
    });

    service = TestBed.inject(AccountBillingCache);
  });

  describe("getSubscription$", () => {
    it("returns subscription from client", async () => {
      accountBillingClient.getSubscription.mockResolvedValue(mockSubscription);

      const result = await firstValueFrom(service.getSubscription$());

      expect(result).toBe(mockSubscription);
      expect(accountBillingClient.getSubscription).toHaveBeenCalledTimes(1);
    });

    it("returns null when client returns null", async () => {
      accountBillingClient.getSubscription.mockResolvedValue(null);

      const result = await firstValueFrom(service.getSubscription$());

      expect(result).toBeNull();
    });

    it("returns cached observable on subsequent calls without hitting API again", async () => {
      accountBillingClient.getSubscription.mockResolvedValue(mockSubscription);

      const first = await firstValueFrom(service.getSubscription$());
      const second = await firstValueFrom(service.getSubscription$());

      expect(first).toBe(mockSubscription);
      expect(second).toBe(mockSubscription);
      expect(accountBillingClient.getSubscription).toHaveBeenCalledTimes(1);
    });

    it("bypasses cache when bypassCache is true", async () => {
      accountBillingClient.getSubscription.mockResolvedValue(mockSubscription);

      await firstValueFrom(service.getSubscription$());
      await firstValueFrom(service.getSubscription$(true));

      expect(accountBillingClient.getSubscription).toHaveBeenCalledTimes(2);
    });
  });

  describe("refresh", () => {
    it("clears cache so next call hits API again", async () => {
      accountBillingClient.getSubscription.mockResolvedValue(mockSubscription);

      await firstValueFrom(service.getSubscription$());
      expect(accountBillingClient.getSubscription).toHaveBeenCalledTimes(1);

      service.refresh();
      await firstValueFrom(service.getSubscription$());
      expect(accountBillingClient.getSubscription).toHaveBeenCalledTimes(2);
    });
  });
});
```

**Step 2: Run tests**

```bash
npx jest apps/web/src/app/billing/services/account-billing-cache.service.spec.ts
```

Expected: All 5 tests pass.

**Step 3: Commit**

```
test(billing): add tests for AccountBillingCache service
```

---

### Task 3: Update `UserLayoutComponent` — menu visibility and dynamic routing

**Files:**

- Modify: `apps/web/src/app/layouts/user-layout.component.ts`
- Modify: `apps/web/src/app/layouts/user-layout.component.html`

**Step 1: Update the component**

In `user-layout.component.ts`:

1. Add imports for `AccountBillingCache`:

```typescript
import { AccountBillingCache } from "@bitwarden/web-vault/app/billing/services";
```

2. Add `AccountBillingCache` to `providers` array (keep `AccountBillingClient` since `AccountBillingCache` depends on it):

```typescript
providers: [AccountBillingClient, AccountBillingCache],
```

3. Add `subscriptionRoute$` field declaration alongside `showSubscription$`:

```typescript
protected subscriptionRoute$: Observable<string>;
```

4. Inject `AccountBillingCache` in constructor (replace `AccountBillingClient` injection):

Replace:

```typescript
private accountBillingClient: AccountBillingClient,
```

With:

```typescript
private accountBillingCache: AccountBillingCache,
```

5. Update `hasSubscription$` to use cache:

Replace:

```typescript
this.hasSubscription$ = this.ifAccountExistsCheck(() =>
  from(this.accountBillingClient.getSubscription()).pipe(
    map((subscription) => !!subscription),
    catchError(() => of(false)),
  ),
);
```

With:

```typescript
this.hasSubscription$ = this.accountBillingCache.getSubscription$().pipe(
  map((subscription) => !!subscription),
  catchError(() => of(false)),
);
```

6. Update `showSubscription$` logic (new rule: `!hasPremiumFromOrg || hasSubscription`):

Replace:

```typescript
this.showSubscription$ = combineLatest([
  this.hasPremiumPersonally$,
  this.hasPremiumFromAnyOrganization$,
  this.hasSubscription$,
]).pipe(
  map(([hasPremiumPersonally, hasPremiumFromAnyOrganization, hasSubscription]) => {
    if (hasPremiumFromAnyOrganization && !hasPremiumPersonally) {
      return false;
    }
    return hasSubscription;
  }),
);
```

With:

```typescript
this.showSubscription$ = combineLatest([
  this.hasPremiumFromAnyOrganization$,
  this.hasSubscription$,
]).pipe(map(([hasPremiumFromOrg, hasSubscription]) => !hasPremiumFromOrg || hasSubscription));

this.subscriptionRoute$ = this.hasSubscription$.pipe(
  map((hasSubscription) =>
    hasSubscription ? "settings/subscription/user-subscription" : "settings/subscription/premium",
  ),
);
```

7. If `hasPremiumPersonally$` is now unused, remove the field declaration and its assignment. Also remove any now-unused imports (e.g. `from` if no longer needed).

**Step 2: Update the template**

In `user-layout.component.html`, change the subscription nav-item from static to dynamic route:

Replace:

```html
<bit-nav-item
  [text]="'subscription' | i18n"
  route="settings/subscription"
  *ngIf="showSubscription$ | async"
></bit-nav-item>
```

With:

```html
<bit-nav-item
  [text]="'subscription' | i18n"
  [route]="subscriptionRoute$ | async"
  *ngIf="showSubscription$ | async"
></bit-nav-item>
```

**Step 3: Verify build**

```bash
npx nx build web --skip-nx-cache 2>&1 | head -50
```

Expected: No compilation errors.

**Step 4: Commit**

```
fix(billing): correct subscription menu visibility and add dynamic routing
```

---

### Task 4: Update `SubscriptionComponent` to use cache

**Files:**

- Modify: `apps/web/src/app/billing/individual/subscription.component.ts`

**Step 1: Update the component**

1. Add import:

```typescript
import { AccountBillingCache } from "../services/account-billing-cache.service";
```

2. Add `AccountBillingCache` to `providers` (keep `AccountBillingClient`):

```typescript
providers: [AccountBillingClient, AccountBillingCache],
```

3. Inject `AccountBillingCache` in constructor, replace `AccountBillingClient`:

Replace:

```typescript
private accountBillingClient: AccountBillingClient,
```

With:

```typescript
private accountBillingCache: AccountBillingCache,
```

4. Update `hasPremium$` to use cache on the feature-flagged path:

Replace:

```typescript
return from(accountBillingClient.getSubscription()).pipe(map((subscription) => !!subscription));
```

With:

```typescript
return accountBillingCache.getSubscription$().pipe(map((subscription) => !!subscription));
```

5. Remove now-unused `from` import if no other usage remains.

**Step 2: Verify build**

```bash
npx nx build web --skip-nx-cache 2>&1 | head -50
```

**Step 3: Commit**

```
refactor(billing): use AccountBillingCache in SubscriptionComponent
```

---

### Task 5: Update `CloudHostedPremiumComponent` — cache + simplified redirects

**Files:**

- Modify: `apps/web/src/app/billing/individual/premium/cloud-hosted-premium.component.ts`

**Step 1: Update the component**

1. Add import:

```typescript
import { AccountBillingCache } from "@bitwarden/web-vault/app/billing/services";
```

2. Add `AccountBillingCache` to `providers` (keep `AccountBillingClient` for other methods like `purchaseSubscription`):

```typescript
providers: [AccountBillingClient, AccountBillingCache],
```

3. Inject `AccountBillingCache` in constructor:

Add parameter:

```typescript
private accountBillingCache: AccountBillingCache,
```

4. Update `hasSubscription$` to use cache:

Replace:

```typescript
this.hasSubscription$ = this.accountService.activeAccount$.pipe(
  switchMap((account) =>
    account
      ? from(this.accountBillingClient.getSubscription()).pipe(
          map((subscription) => !!subscription),
          catchError(() => of(false)),
        )
      : of(false),
  ),
);
```

With:

```typescript
this.hasSubscription$ = this.accountBillingCache.getSubscription$().pipe(
  map((subscription) => !!subscription),
  catchError(() => of(false)),
);
```

5. Simplify redirect logic (remove `hasPremiumPersonally` check):

Replace:

```typescript
combineLatest([
  this.hasPremiumFromAnyOrganization$,
  this.hasPremiumPersonally$,
  this.hasSubscription$,
])
  .pipe(
    takeUntilDestroyed(this.destroyRef),
    switchMap(([hasPremiumFromOrg, hasPremiumPersonally, hasSubscription]) => {
      if (hasPremiumPersonally && hasSubscription) {
        return from(this.navigateToSubscriptionPage());
      }
      if (hasPremiumFromOrg) {
        return from(this.navigateToIndividualVault());
      }
      return of(true);
    }),
  )
  .subscribe();
```

With:

```typescript
combineLatest([this.hasSubscription$, this.hasPremiumFromAnyOrganization$])
  .pipe(
    takeUntilDestroyed(this.destroyRef),
    switchMap(([hasSubscription, hasPremiumFromOrg]) => {
      if (hasSubscription) {
        return from(this.navigateToSubscriptionPage());
      }
      if (hasPremiumFromOrg) {
        return from(this.navigateToIndividualVault());
      }
      return of(true);
    }),
  )
  .subscribe();
```

**Step 2: Verify build**

```bash
npx nx build web --skip-nx-cache 2>&1 | head -50
```

**Step 3: Commit**

```
fix(billing): simplify premium page redirects and use AccountBillingCache
```

---

### Task 6: Update `AccountSubscriptionComponent` — cache + refresh on mutations

**Files:**

- Modify: `apps/web/src/app/billing/individual/subscription/account-subscription.component.ts`

**Step 1: Update the component**

1. Add import:

```typescript
import { AccountBillingCache } from "@bitwarden/web-vault/app/billing/services";
```

2. Add `AccountBillingCache` to `providers` (keep `AccountBillingClient` for mutation methods):

```typescript
providers: [AccountBillingClient, AccountBillingCache],
```

3. Add injection:

```typescript
private accountBillingCache = inject(AccountBillingCache);
```

4. Update resource loader to use cache:

Replace:

```typescript
const subscription = await this.accountBillingClient.getSubscription();
```

With:

```typescript
const subscription = await firstValueFrom(this.accountBillingCache.getSubscription$());
```

5. Add `this.accountBillingCache.refresh()` before every `this.subscription.reload()` call. There are 4 locations:

   a. In `onSubscriptionCardAction`, `ReinstateSubscription` case:

   ```typescript
   this.accountBillingCache.refresh();
   this.subscription.reload();
   ```

   b. In `onSubscriptionCardAction`, `Resubscribe` case:

   ```typescript
   if (result?.status === UnifiedUpgradeDialogStatus.UpgradedToPremium) {
     this.accountBillingCache.refresh();
     this.subscription.reload();
   }
   ```

   c. In `onStorageCardAction`:

   ```typescript
   if (result === "submitted") {
     this.accountBillingCache.refresh();
     this.subscription.reload();
   }
   ```

   d. In `onAdditionalOptionsCardAction`, `CancelSubscription` case:

   ```typescript
   this.accountBillingCache.refresh();
   this.subscription.reload();
   ```

**Step 2: Verify build**

```bash
npx nx build web --skip-nx-cache 2>&1 | head -50
```

**Step 3: Commit**

```
refactor(billing): use AccountBillingCache in AccountSubscriptionComponent with refresh on mutations
```
