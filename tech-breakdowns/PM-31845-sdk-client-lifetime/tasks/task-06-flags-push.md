# Task 06 — Owner push: feature flags (`ConfigService.renewConfig → sdkService.setFlags`)

- **Repo:** `clients`
- **Team:** Platform

## Goal

When the server config is refreshed, push the resolved feature flags into the user's live SDK client,
honoring **push-then-emit**: push to the SDK **before** persisting `USER_SERVER_CONFIG`, so a reactive
consumer of the config never sees new flags with a client the SDK hasn't updated. The flags come from the
in-memory `newConfig`, so there's no read-back — the reorder is free.

## Files

- `libs/common/src/platform/services/config/default-config.service.ts` (+ `config.service.spec.ts`)

## Implementation (sample code)

Inject `SdkService` and push in `renewConfig` **before** persisting the config:

```ts
constructor(
  // …existing deps…
  private authService: AuthService,
  private sdkService: SdkService,            // NEW
) { /* … */ }
```

Push only in the **per-user** branch (the `userId != null` path that writes `USER_SERVER_CONFIG`). The
global branch (`userId == null` → `GLOBAL_SERVER_CONFIGURATIONS`) has no per-user SDK client to push to —
`setFlags` takes a `UserId` — so it's skipped.

```ts
// inside renewConfig(), the per-user (userId != null) success branch that writes USER_SERVER_CONFIG:
// Push-then-emit: update the SDK before persisting the config the observable reflects.
await this.sdkService.setFlags(userId, toSdkFeatureFlags(newConfig));
await this.stateProvider.setUserState(USER_SERVER_CONFIG, newConfig, userId);
```

Add the helper (module scope):

```ts
/** The SDK only supports boolean feature flags at this time. */
function toSdkFeatureFlags(config: ServerConfig): Map<string, boolean> {
  return new Map(
    Object.entries(config?.featureStates ?? {})
      .filter(([, value]) => typeof value === "boolean")
      .map(([key, value]) => [key, value] as [string, boolean]),
  );
}
```

Add `SdkService` to the `ConfigService` provider deps (jslib) and to its cli/browser construction.
`SdkService` is injected **eagerly**, so in the cli/browser manual DI move the `sdkService` construction
**above** `configService` (its other deps are already built earlier; `SdkService` resolves `ConfigService`
lazily, so this is safe). Move only the `sdkClientFactory` / `sdkLoadService` / `sdkService` block — leave
later consumers (`registerSdkService`, etc.) where they are.

## Tests

`config.service.spec.ts`: provide a `mock<SdkService>()`; assert `setFlags` is called with the expected
map on a successful `renewConfig`.

## Acceptance criteria

- [ ] `renewConfig` calls `sdkService.setFlags(userId, <boolean flags>)` **before** persisting config (push-then-emit).
- [ ] `ConfigService` ↔ `SdkService` does not form a construction cycle (Legacy's `ConfigService` dep is lazy — task-05).
- [ ] `config.service.spec.ts` green; `npm run test:types` green.
