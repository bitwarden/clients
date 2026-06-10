# Task 05 — Seam: extend the `SdkService` abstraction + no-op pushes on `DefaultSdkService`

- **Repo:** `clients`
- **Team:** Platform

## Goal

Add the push API to the `SdkService` **abstraction**, and implement it as **no-ops** on the existing
reactive `DefaultSdkService` (no rename — the class will gain the long-lived path in
[task-10](task-10-new-pushdriven-impl-and-flag.md), branched by the flag). Lazy-resolve the deps that
would otherwise form a construction cycle once owners inject `SdkService`. This lets the owner-push
tasks ([06](task-06-flags-push.md)–[09](task-09-orgkeys-push.md)) land independently and safely — the
pushes are no-ops for now, so the reactive `internalClient$` keeps driving everything.

> **Strategy:** flag-gated **single class** (overlay). `DefaultSdkService` temporarily holds both the
> legacy reactive `internalClient$` and (from task-10) the long-lived push machinery, branching on
> `FeatureFlag.PM31845_LongLivedSdkClient` inside `userClient$` / the push methods / the `accounts$`
> subscription. No second class, no selector.

## Why the lazy deps

On `main`, `DefaultSdkService` injects `ConfigService` and `KeyService` (for `internalClient$`). The
moment `ConfigService` / `KeyService` inject `SdkService` to push into it (tasks 06/07/09), you close a
**2-node construction cycle** that manual DI (cli/browser) can't build. Lazy-resolving those deps
(`() => KeyService`, `() => ConfigService`) defers resolution to subscription/call time, after
bootstrap. All four legacy-path deps end up lazy: `KdfConfigService` because `SdkService` is now
constructed _before_ it in manual DI (a forward reference, not a cycle), and
`AccountCryptographicStateService` for uniformity (built before `SdkService` in cli/browser — neither a
cycle nor a forward reference, but kept lazy alongside the others rather than special-casing it).

## Files

- `libs/common/src/platform/abstractions/sdk/sdk.service.ts` — add `SdkUnlockData` + abstract methods.
- `libs/common/src/platform/services/sdk/default-sdk.service.ts` — no-op push methods; lazy cycle deps; keep `internalClient$`.
- `libs/common/src/platform/spec/mock-sdk.service.ts` — add the push methods to the mock.

## Implementation (sample code)

### Abstraction — `sdk.service.ts`

```ts
/** The data needed to initialize user crypto on an existing client, pushed by the unlock flow. */
export interface SdkUnlockData {
  userKey: UserKey;
  email: string;
  kdf: Kdf;
  accountCryptographicState: WrappedAccountCryptographicState;
  orgKeys: Record<OrganizationId, EncString>;
}

export abstract class SdkService {
  abstract version$: Observable<string>;
  abstract client$: Observable<PasswordManagerClient>;
  abstract userClient$(userId: UserId): Observable<Rc<PasswordManagerClient>>;

  /** Initialize (or re-initialize) user + org crypto on the user's existing client. */
  abstract unlock(userId: UserId, data: SdkUnlockData): Promise<void>;
  /** Clear the in-memory user key (lock). */
  abstract lock(userId: UserId): Promise<void>;
  /** Dispose the user's client and complete its `userClient$` (logout). */
  abstract logout(userId: UserId): void;
  /** Apply feature flags to the user's live client. */
  abstract setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void>;
  /** Apply organization keys to the user's live client. */
  abstract setOrgKeys(userId: UserId, orgKeys: Record<OrganizationId, EncString>): Promise<void>;
}
```

> Keep `setClient` on the abstraction for now if anything still references it — removed in cleanup
> ([task-12](task-12-cleanup-remove-legacy.md)). (On `main` it's already dormant.)

### `default-sdk.service.ts` — no-op pushes + lazy cycle deps

Keep the existing reactive `internalClient$` exactly as-is, but (a) lazy-resolve cycle deps and (b) add
no-op push methods (they get real, flag-gated long-lived behavior in task-10):

```ts
export class DefaultSdkService implements SdkService {
  constructor(
    private sdkClientFactory: SdkClientFactory,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private accountService: AccountService,
    private kdfConfigServiceProvider: () => KdfConfigService, // lazy — SdkService now constructs first
    private keyServiceProvider: () => KeyService, // lazy — breaks KeyService ↔ SdkService
    private accountCryptographyStateServiceProvider: () => AccountCryptographicStateService, // lazy — uniformity
    private apiServiceProvider: () => ApiService, // lazy (task-03)
    private stateProvider: StateProvider,
    private configServiceProvider: () => ConfigService, // lazy — breaks ConfigService ↔ SdkService
    private userAgent: string | null = null,
  ) {}

  // Push API: no-ops for now. The reactive internalClient$ drives everything until task-10 adds the
  // long-lived machinery + the flag branch. Full signatures (matching the abstraction) even though the
  // params are unused — the repo's no-unused-vars is configured `args: "none"`, so this is lint-clean.
  async unlock(userId: UserId, data: SdkUnlockData): Promise<void> {}
  async lock(userId: UserId): Promise<void> {}
  logout(userId: UserId): void {}
  async setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void> {}
  async setOrgKeys(userId: UserId, orgKeys: Record<OrganizationId, EncString>): Promise<void> {}

  // userClient$, client$, version$, internalClient$ unchanged — but read cycle deps via the providers,
  // e.g. this.keyServiceProvider().userKey$(userId), this.configServiceProvider() in loadFeatureFlags.
}
```

### Mock — `mock-sdk.service.ts`

Add the five push methods so `mock<SdkService>()` and the hand-written mock satisfy the abstraction.

## Tests

- Existing `default-sdk.service.spec.ts` (reactive behavior) stays green.
- Add a trivial test that the no-op push methods resolve without touching the client.

## Acceptance criteria

- [ ] Abstraction exposes `SdkUnlockData` + `unlock`/`lock`/`logout`/`setFlags`/`setOrgKeys`.
- [ ] `DefaultSdkService` implements them as no-ops; cycle deps lazy-resolved; `internalClient$` intact.
- [ ] An owner service _could_ inject `SdkService` without a construction cycle (proven by task-06).
- [ ] `npm run test:types` green; app boots; **no behavior change** (push methods unused yet).
