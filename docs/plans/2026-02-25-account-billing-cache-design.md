# Account Billing Cache Design

## Problem

The individual billing navigation chain (`UserLayoutComponent` → `SubscriptionComponent` → `CloudHostedPremiumComponent` / `AccountSubscriptionComponent`) makes redundant API calls to `AccountBillingClient.getSubscription()`. Each component provides its own `AccountBillingClient` instance with no shared caching. Additionally, the subscription menu visibility logic and routing don't correctly handle all user state permutations.

## Data Permutations

| Has Premium (DB) | Has Subscription (Stripe) | Has Premium From Org | Show Menu | Route To     |
| ---------------- | ------------------------- | -------------------- | --------- | ------------ |
| No               | No                        | No                   | Yes       | Premium      |
| Yes              | No                        | No                   | Yes       | Premium      |
| No               | Yes                       | No                   | Yes       | Subscription |
| Yes              | Yes                       | No                   | Yes       | Subscription |
| No               | No                        | Yes                  | No        | N/A          |
| Yes              | No                        | Yes                  | No        | N/A          |
| No               | Yes                       | Yes                  | Yes       | Subscription |
| Yes              | Yes                       | Yes                  | Yes       | Subscription |

Derived rules:

- **Menu visibility:** `!hasPremiumFromOrg || hasSubscription`
- **Route target:** `hasSubscription ? user-subscription : premium`

## Solution

### New Service: `AccountBillingCache`

- **Location:** `apps/web/src/app/billing/services/account-billing-cache.service.ts`
- **Decorator:** `@Injectable()` (not `providedIn: 'root'`)
- **Provided in:** `UserLayoutComponent.providers` array, shared with all child routes via Angular DI
- **Pattern:** Read-through cache matching `OrganizationWarningsService`

API:

- `getSubscription$(bypassCache?: boolean)` — returns cached `Observable<Maybe<BitwardenSubscription>>`
- `refresh()` — clears cache; consumers manually call after mutations

Cache invalidation is manual (option 2): components that mutate subscription data call `refresh()` explicitly, aligning with the existing `subscription.reload()` pattern in `AccountSubscriptionComponent`.

### Consumer Changes

**user-layout.component.ts:**

- Inject `AccountBillingCache`, add to `providers` alongside existing `AccountBillingClient`
- `showSubscription$` logic: `!hasPremiumFromOrg || hasSubscription`
- New `subscriptionRoute$`: `hasSubscription ? 'settings/subscription/user-subscription' : 'settings/subscription/premium'`
- Template binds route dynamically instead of hardcoding `settings/subscription`

**subscription.component.ts:**

- Inject `AccountBillingCache`
- Swap `accountBillingClient.getSubscription()` for `accountBillingCache.getSubscription$()`
- Feature flag logic stays; new path uses cached observable

**cloud-hosted-premium.component.ts:**

- Inject `AccountBillingCache`
- Use `accountBillingCache.getSubscription$()` for `hasSubscription$`
- Simplified redirect rules:
  1. `hasSubscription` → redirect to subscription page
  2. `hasPremiumFromOrg` → redirect to vault
  3. Otherwise → stay on premium page (free user or CS use case)

**account-subscription.component.ts:**

- Inject `AccountBillingCache`
- `resource` loader uses `accountBillingCache.getSubscription$()` for initial load
- After mutations (`reinstateSubscription`, storage adjustments, cancel), call `accountBillingCache.refresh()` then re-fetch

## Feature Flag

`PM29594_UpdateIndividualSubscriptionPage` is kept. These changes are part of getting it ready to enable.
