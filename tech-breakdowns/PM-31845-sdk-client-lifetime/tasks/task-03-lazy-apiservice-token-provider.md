# Task 03 — Lazy `() => ApiService` token provider on `SdkService`

- **Repo:** `clients`
- **Team:** Platform

## Goal

`SdkService` only needs `ApiService` for the token provider. Resolving it **lazily** (a `() => ApiService`
thunk) instead of injecting it directly removes the runtime DI cycle
`SdkService → ApiService → VaultTimeoutSettingsService → KeyService → SdkService`, which is the
prerequisite for any owner service to later inject `SdkService`.

This task makes only that one change. The reactive `internalClient$` and the rest of `DefaultSdkService`
stay exactly as they are on `main`.

## Files

- `libs/common/src/platform/services/sdk/default-sdk.service.ts` — `JsTokenProvider` + constructor.
- `libs/angular/src/services/jslib-services.module.ts` — `SdkService` provider.
- `apps/cli/src/service-container/service-container.ts` — `SdkService` construction.
- `apps/browser/src/background/main.background.ts` — `SdkService` construction.

## Implementation (sample code)

`default-sdk.service.ts` — make the token provider hold a thunk:

```ts
class JsTokenProvider implements TokenProvider {
  constructor(
    private apiServiceProvider: () => ApiService, // was: private apiService: ApiService
    private userId?: UserId,
  ) {}

  async get_access_token(): Promise<string | undefined> {
    if (this.userId == null) {
      return undefined;
    }
    return await this.apiServiceProvider().getActiveBearerToken(this.userId);
  }
}
```

In `DefaultSdkService`, replace the `apiService` constructor param with `apiServiceProvider: () => ApiService`
and update the two `new JsTokenProvider(...)` sites to pass `this.apiServiceProvider`.

`jslib-services.module.ts` — resolve lazily via the `Injector`, so construction no longer depends on `ApiService`:

```ts
safeProvider({
  provide: SdkService,
  useFactory: (
    sdkClientFactory: SdkClientFactory,
    environmentService: EnvironmentService,
    platformUtilsService: PlatformUtilsServiceAbstraction,
    accountService: AccountServiceAbstraction,
    /* …existing reactive deps stay… */
    injector: Injector,
  ) =>
    new DefaultSdkService(
      sdkClientFactory,
      environmentService,
      platformUtilsService,
      accountService,
      // Resolved lazily to break the cycle: ApiService -> VaultTimeoutSettingsService -> KeyService -> SdkService.
      () => injector.get(ApiServiceAbstraction),
      /* …existing reactive deps… */
    ),
  deps: [/* …existing…, */ Injector],
}),
```

In cli / browser, pass `() => this.apiService` instead of `this.apiService`.

## Tests

- `default-sdk.service.spec.ts` construction site: pass `() => apiService`.
- No behavioral assertions change.

## Acceptance criteria

- [ ] `SdkService`'s constructor takes `() => ApiService`; `JsTokenProvider` resolves the token through it.
- [ ] jslib/cli/browser provider sites updated.
- [ ] Full workspace `npm run test:types` green; app boots (no behavior change).
