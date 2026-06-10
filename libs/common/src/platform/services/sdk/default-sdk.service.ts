import {
  BehaviorSubject,
  catchError,
  combineLatest,
  concatMap,
  defer,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  ReplaySubject,
  share,
  shareReplay,
  switchMap,
  takeWhile,
  tap,
  throwIfEmpty,
  timer,
} from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService, KdfConfigService } from "@bitwarden/key-management";
import {
  PasswordManagerClient,
  ClientSettings,
  TokenProvider,
  UnsignedSharedKey,
  WrappedAccountCryptographicState,
  Kdf,
  InitOrgCryptoRequest,
} from "@bitwarden/sdk-internal";

import { ApiService } from "../../../abstractions/api.service";
import { AccountInfo, AccountService } from "../../../auth/abstractions/account.service";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { AccountCryptographicStateService } from "../../../key-management/account-cryptography/account-cryptographic-state.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { JsWasmStateBridge } from "../../../key-management/state-bridge";
import { OrganizationId, UserId } from "../../../types/guid";
import { ConfigService } from "../../abstractions/config/config.service";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import {
  asUuid,
  SdkService,
  SdkUnlockData,
  toSdkDevice,
  UserNotLoggedInError,
} from "../../abstractions/sdk/sdk.service";
import { compareValues } from "../../misc/compare-values";
import { Rc } from "../../misc/reference-counting/rc";
import { StateProvider } from "../../state";

import { initializeClientManagedState } from "./client-managed-state";

/**
 * A token provider that exposes the access token to the SDK.
 *
 * `ApiService` is resolved lazily (via a provider function) rather than injected, so `SdkService`'s
 * construction does not depend on `ApiService`. This is what breaks the DI cycle
 * (`SdkService → ApiService → VaultTimeoutSettingsService → KeyService`) and lets `KeyService`,
 * `ConfigService`, and the auth services depend on `SdkService` to push state into it.
 */
class JsTokenProvider implements TokenProvider {
  constructor(
    private apiServiceProvider: () => ApiService,
    private userId?: UserId,
  ) {}

  async get_access_token(): Promise<string | undefined> {
    if (this.userId == null) {
      return undefined;
    }

    return await this.apiServiceProvider().getActiveBearerToken(this.userId);
  }
}

/**
 * The SDK service holds the per-user SDK clients. It currently runs **two** implementations, selected
 * by {@link FeatureFlag.PM31845_LongLivedSdkClient} (captured once at startup):
 *
 *   - **flag off (legacy):** the reactive `internalClient$` rebuilds the client from observable inputs
 *     (env, account, KDF, crypto state, user key, org keys) and tears it down 1s after the last
 *     unsubscribe. This is today's behavior; it is the default and the rollback path.
 *   - **flag on (long-lived):** a token-only client is created per logged-in user from `accounts$` and
 *     mutated in place by the owning services (unlock/lock/logout/setFlags/setOrgKeys); it is disposed
 *     only on logout.
 *
 * The cycle-participating deps (`KeyService`, `ConfigService`) are resolved lazily so the owning
 * services can inject `SdkService` to push into it without forming a construction cycle. The legacy
 * branch + the flag are removed once the rollout sticks (PM-31845 cleanup).
 */
export class DefaultSdkService implements SdkService {
  // --- long-lived path (flag on) ---
  /**
   * The long-lived per-user clients. Client existence follows account existence: a token-only
   * client is created when a user appears in {@link AccountService.accounts$} (covering login,
   * app restart, and browser service-worker wake), and removed only on logout.
   */
  private clients$ = new BehaviorSubject<{
    [userId: UserId]: Rc<PasswordManagerClient> | undefined;
  }>({});

  /** Dedupes concurrent token-only client builds for the same user. */
  private creating = new Map<UserId, Promise<void>>();

  /** Users whose client currently has user crypto initialized (needed to gate org-key updates). */
  private unlocked = new Set<UserId>();

  // --- legacy path (flag off) ---
  private sdkClientCache = new Map<UserId, Observable<Rc<PasswordManagerClient>>>();

  // --- rollout flag, captured once ---
  private enabled: Promise<boolean> | undefined;

  client$ = this.environmentService.environment$.pipe(
    concatMap(async (env) => {
      await SdkLoadService.Ready;
      const settings = await this.toSettings(env);
      const client = await this.sdkClientFactory.createSdkClient(
        new JsTokenProvider(this.apiServiceProvider),
        settings,
      );
      await this.loadFeatureFlags(client);
      return client;
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  version$ = this.client$.pipe(
    map((client) => client.version()),
    catchError(() => "Unsupported"),
  );

  constructor(
    private sdkClientFactory: SdkClientFactory,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private accountService: AccountService,
    // The legacy-path deps are resolved lazily (functions) so this service can be constructed before
    // them (cli/browser construct it early) and so the services that push into it can inject it without
    // a construction cycle. They are touched only when the reactive `internalClient$` is subscribed.
    private kdfConfigServiceProvider: () => KdfConfigService,
    private keyServiceProvider: () => KeyService,
    private accountCryptographyStateServiceProvider: () => AccountCryptographicStateService,
    private apiServiceProvider: () => ApiService,
    private stateProvider: StateProvider,
    private configServiceProvider: () => ConfigService,
    private userAgent: string | null = null,
  ) {
    // Long-lived path only: client existence follows account existence. `accounts$` is backed by
    // persisted state, so this fires on fresh login AND on rehydration after a restart / service-worker
    // wake — one path, unlike hooking the imperative `addAccount`. Gated on the flag so the reactive
    // (flag-off) path is untouched.
    //
    // `accounts$` (a shared state observable) can replay its current value synchronously on subscribe,
    // so the work is deferred to a microtask: we must not resolve the lazy `ConfigService`/`KeyService`
    // while `SdkService` is still constructing — that would be a DI cycle in Angular and an undefined
    // `this.configService` in cli/browser (constructed right after, synchronously). A microtask runs
    // only after the synchronous construction sequence unwinds, by which point both are ready.
    this.accountService.accounts$.subscribe(
      (accounts) =>
        void Promise.resolve().then(async () => {
          if (!(await this.longLivedEnabled())) {
            return;
          }
          for (const userId of Object.keys(accounts) as UserId[]) {
            void this.ensureClient(userId);
          }
        }),
    );
  }

  /**
   * Resolve {@link FeatureFlag.PM31845_LongLivedSdkClient} once, then reuse — captured once, no live
   * updates (the singleton can't swap paths mid-session). We deliberately do NOT wait for a fresh
   * config fetch; a stale/persisted flag value is acceptable and avoids blocking startup.
   *
   * Only ever called post-construction (the `accounts$` subscription defers to a microtask;
   * `userClient$`/the push methods are called by consumers after bootstrap), so resolving the lazy
   * `ConfigService` here is safe.
   */
  private longLivedEnabled(): Promise<boolean> {
    return (this.enabled ??= this.configServiceProvider().getFeatureFlag(
      FeatureFlag.PM31845_LongLivedSdkClient,
    ));
  }

  userClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    return defer(() => this.longLivedEnabled()).pipe(
      switchMap((longLived) =>
        longLived ? this.longLivedUserClient$(userId) : this.legacyUserClient$(userId),
      ),
    );
  }

  /**
   * Initialize user + org crypto on the user's existing client. Driven by the unlock flow, which
   * supplies the decrypted key and the rest of the crypto payload. Re-invoking for a key rotation is
   * an in-place mutation, not a rebuild. No-op while the flag is off (the reactive path drives unlock).
   */
  async unlock(userId: UserId, data: SdkUnlockData): Promise<void> {
    if (!(await this.longLivedEnabled())) {
      return;
    }
    await this.ensureClient(userId);
    await this.withClient(userId, async (client) => {
      // initialize_crypto is idempotent + atomic: the SDK clears any existing crypto, then sets user +
      // org crypto in one call. Safe to (re)run on an already-unlocked client — both unlock writers
      // (DefaultUnlockService + keyService.setUserKey) fire for one unlock, and refreshAdditionalKeys /
      // key rotation re-unlock too; a plain initialize_user_crypto would hit the SDK's "already
      // initialized" guard. The inline `decryptedKey` is copied back to USER_KEY state by the SDK (a
      // harmless redundant write while the caller still writes it; dropped at cleanup). Do NOT switch to
      // clientManagedState (stale-read risk on the setUserKey/rotation path).
      await client.crypto().initialize_crypto(
        {
          userId: asUuid(userId),
          email: data.email,
          method: { decryptedKey: { decrypted_user_key: data.userKey.toSdk() } },
          kdfParams: data.kdf,
          accountCryptographicState: data.accountCryptographicState,
        },
        toSdkOrgCrypto(data.orgKeys),
      );
    });
    this.unlocked.add(userId);
  }

  /**
   * Clear the in-memory user key. Driven by `LockService.lock`, which also triggers a process reload
   * as defense in depth. No-op while the flag is off (the reactive path drives lock).
   *
   * Interim implementation: dispose the unlocked client (freeing its WASM memory, which clears the
   * key) and replace it with a token-only, key-cleared client. Once the prerequisite in-place lock
   * lands in `sdk-internal` (PM-31845 Task 1) — exposed on the new unlock client off
   * `PasswordManagerClient` — this collapses to a single in-place call that retains the same
   * long-lived client instance across lock → unlock:
   *   await this.withClient(userId, (client) => client.unlock().lock());
   */
  async lock(userId: UserId): Promise<void> {
    if (!(await this.longLivedEnabled())) {
      return;
    }
    this.unlocked.delete(userId);
    // Dispose the unlocked client first so its in-memory user key is freed even if the token-only
    // rebuild below throws. `userClient$` waits (account still present) until the replacement lands.
    this.publish(userId, undefined);
    const client = await this.buildTokenOnlyClient(userId);
    this.publish(userId, new Rc(client));
  }

  /**
   * Dispose the client and complete `userClient$` (which also completes when the account leaves
   * `accounts$`). No-op while the flag is off (the reactive path tears down on its own).
   */
  logout(userId: UserId): void {
    void this.longLivedEnabled().then((longLived) => {
      if (!longLived) {
        return;
      }
      this.unlocked.delete(userId);
      this.publish(userId, undefined);
    });
  }

  /** Apply feature flags to the user's live client. Driven by `ConfigService`. No-op while the flag is off. */
  async setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void> {
    if (!(await this.longLivedEnabled())) {
      return;
    }
    await this.withClient(userId, (client) => client.platform().load_flags(flags));
  }

  /** Apply organization keys to the user's live client. Driven by `KeyService`. No-op while the flag is off or locked. */
  async setOrgKeys(userId: UserId, orgKeys: Record<OrganizationId, EncString>): Promise<void> {
    if (!(await this.longLivedEnabled()) || !this.unlocked.has(userId)) {
      return;
    }
    await this.withClient(userId, (client) => initializeOrgCrypto(client, orgKeys));
  }

  // --- long-lived path (flag on) ---

  private longLivedUserClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    const loggedIn$ = this.accountService.accounts$.pipe(
      map((accounts) => accounts[userId] != null),
      distinctUntilChanged(),
    );

    return combineLatest([loggedIn$, this.clients$]).pipe(
      // Complete (→ UserNotLoggedInError if nothing was emitted) once the account is gone — i.e. on
      // logout. While the account exists but the client is still being built, we simply don't emit
      // yet (wait), instead of falsely erroring.
      takeWhile(([loggedIn]) => loggedIn, false),
      map(([, clients]) => clients[userId]),
      filter(
        (client): client is Rc<PasswordManagerClient> =>
          client != null && !client.isMarkedForDisposal,
      ),
      distinctUntilChanged(),
      throwIfEmpty(() => new UserNotLoggedInError(userId)),
    );
  }

  /** Idempotently ensure a token-only client exists for the user, deduping concurrent builds. */
  private ensureClient(userId: UserId): Promise<void> {
    if (this.clients$.value[userId] != null) {
      return Promise.resolve();
    }
    let creation = this.creating.get(userId);
    if (creation == null) {
      creation = this.buildTokenOnlyClient(userId)
        .then(async (client) => {
          // The user may have logged out, or a client may have been set, while we were building.
          // Only publish if the user is still logged in and no client was set in the meantime;
          // otherwise free the freshly-built client so it isn't leaked.
          const loggedIn = (await firstValueFrom(this.accountService.accounts$))[userId] != null;
          if (loggedIn && this.clients$.value[userId] == null) {
            this.publish(userId, new Rc(client));
          } else {
            client.free();
          }
        })
        .finally(() => this.creating.delete(userId));
      this.creating.set(userId, creation);
    }
    return creation;
  }

  /**
   * Build a token-only client: token provider + client-managed state + KM state bridge. No crypto,
   * no user flags. The state bridge lets the SDK read/write key-management state (user key, PIN
   * envelope, master-password unlock data, …) so SDK-managed unlock paths work on the live client.
   */
  private async buildTokenOnlyClient(userId: UserId): Promise<PasswordManagerClient> {
    await SdkLoadService.Ready;
    const env = await this.environment(userId);
    const settings = await this.toSettings(env);
    const client = await this.sdkClientFactory.createSdkClient(
      new JsTokenProvider(this.apiServiceProvider, userId),
      settings,
    );
    await initializeClientManagedState(userId, client.platform().state(), this.stateProvider);
    client
      .km_state_bridge()
      .register_bridge_impl(new JsWasmStateBridge(this.stateProvider, userId));
    return client;
  }

  private async withClient(
    userId: UserId,
    fn: (client: PasswordManagerClient) => Promise<void>,
  ): Promise<void> {
    const rc = this.clients$.value[userId];
    if (rc == null || rc.isMarkedForDisposal) {
      return;
    }
    using ref = rc.take();
    await fn(ref.value);
  }

  private publish(userId: UserId, rc: Rc<PasswordManagerClient> | undefined): void {
    const previous = this.clients$.value[userId];
    this.clients$.next({ ...this.clients$.value, [userId]: rc });
    // Every caller passes either `undefined` or a freshly-built `Rc`, never the existing instance,
    // so the previous client (if any) is always being replaced and should be disposed once any
    // in-flight `take()` references are released.
    previous?.markForDisposal();
  }

  // --- legacy path (flag off): the reactive build retained for rollback, removed at cleanup ---

  private legacyUserClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    return this.internalClient$(userId).pipe(
      takeWhile((client) => client !== undefined, false),
      // Filter out clients that have been marked for disposal. This can happen in the race window where
      // `internalClient$`'s `combineLatest` re-emits (e.g. during unlock when org keys / user key
      // re-emit): the previous inner Observable's cleanup marks the old Rc for disposal before the new
      // client finishes its async initialization.
      filter((client) => !client.isMarkedForDisposal),
      throwIfEmpty(() => new UserNotLoggedInError(userId)),
    );
  }

  private internalClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    const cached = this.sdkClientCache.get(userId);
    if (cached !== undefined) {
      return cached;
    }

    const keyService = this.keyServiceProvider();
    const account$ = this.accountService.accounts$.pipe(
      map((accounts) => accounts[userId]),
      distinctUntilChanged(),
    );
    const kdfParams$ = this.kdfConfigServiceProvider()
      .getKdfConfig$(userId)
      .pipe(distinctUntilChanged());
    const accountCryptographicState$ = this.accountCryptographyStateServiceProvider()
      .accountCryptographicState$(userId)
      .pipe(distinctUntilChanged());
    const userKey$ = keyService.userKey$(userId).pipe(distinctUntilChanged());
    const orgKeys$ = keyService.encryptedOrgKeys$(userId).pipe(
      distinctUntilChanged(compareValues), // The upstream observable emits different objects with the same values
    );

    const client$ = combineLatest([
      this.environmentService.getEnvironment$(userId),
      account$,
      kdfParams$,
      accountCryptographicState$,
      userKey$,
      orgKeys$,
      SdkLoadService.Ready, // Makes sure we wait (once) for the SDK to be loaded
    ]).pipe(
      // switchMap is required to allow the clean-up logic to be executed when `combineLatest` emits a new value.
      switchMap(([env, account, kdfParams, accountCryptographicState, userKey, orgKeys]) => {
        // Create our own observable to be able to implement clean-up logic
        return new Observable<Rc<PasswordManagerClient>>((subscriber) => {
          const createAndInitializeClient = async () => {
            if (env == null) {
              return undefined;
            }

            const settings = await this.toSettings(env);
            const client = await this.sdkClientFactory.createSdkClient(
              new JsTokenProvider(this.apiServiceProvider, userId),
              settings,
            );
            await this.initializeClient(userId, client);

            // Returns a locked SDK client, if any of these values are missing
            if (kdfParams == null || accountCryptographicState == null || userKey == null) {
              return client;
            }

            await this.initializeClientCrypto(
              userId,
              client,
              account,
              kdfParams.toSdkConfig(),
              accountCryptographicState,
              orgKeys,
            );

            return client;
          };

          let client: Rc<PasswordManagerClient> | undefined;
          createAndInitializeClient()
            .then((c) => {
              client = c === undefined ? undefined : new Rc(c);

              subscriber.next(client);
            })
            .catch((e) => {
              subscriber.error(e);
            });

          return () => client?.markForDisposal();
        });
      }),
      tap({ finalize: () => this.sdkClientCache.delete(userId) }),
      share({
        connector: () => new ReplaySubject(1),
        resetOnRefCountZero: () => timer(1000),
      }),
    );

    this.sdkClientCache.set(userId, client$);
    return client$;
  }

  private async initializeClient(userId: UserId, client: PasswordManagerClient) {
    // Initialize the client managed repositories.
    await initializeClientManagedState(userId, client.platform().state(), this.stateProvider);
    client
      .km_state_bridge()
      .register_bridge_impl(new JsWasmStateBridge(this.stateProvider, userId));
    await this.loadFeatureFlags(client);
  }

  private async initializeClientCrypto(
    userId: UserId,
    client: PasswordManagerClient,
    account: AccountInfo,
    kdf: Kdf,
    accountCryptographicState: WrappedAccountCryptographicState,
    orgKeys: Record<OrganizationId, EncString>,
  ) {
    await client.crypto().initialize_user_crypto({
      userId: asUuid(userId),
      email: account.email,
      method: { clientManagedState: {} },
      kdfParams: kdf,
      accountCryptographicState: accountCryptographicState,
    });

    // We initialize the org crypto even if the org_keys are
    // null to make sure any existing org keys are cleared.
    await initializeOrgCrypto(client, orgKeys);
  }

  private async loadFeatureFlags(client: PasswordManagerClient) {
    const serverConfig = await firstValueFrom(this.configServiceProvider().serverConfig$);

    const featureFlagMap = new Map(
      Object.entries(serverConfig?.featureStates ?? {})
        .filter(([, value]) => typeof value === "boolean") // The SDK only supports boolean feature flags at this time
        .map(([key, value]) => [key, value] as [string, boolean]),
    );

    await client.platform().load_flags(featureFlagMap);
  }

  // --- shared ---

  private async environment(userId: UserId): Promise<Environment> {
    return await firstValueFrom(this.environmentService.getEnvironment$(userId));
  }

  private async toSettings(env: Environment): Promise<ClientSettings> {
    return {
      apiUrl: env.getApiUrl(),
      identityUrl: env.getIdentityUrl(),
      deviceType: toSdkDevice(this.platformUtilsService.getDevice()),
      bitwardenClientVersion: await this.platformUtilsService.getApplicationVersionNumber(),
      userAgent: this.userAgent ?? navigator.userAgent,
    };
  }
}

function toSdkOrgCrypto(orgKeys: Record<OrganizationId, EncString>): InitOrgCryptoRequest {
  return {
    organizationKeys: new Map(
      Object.entries(orgKeys).map(([k, v]) => [asUuid(k), v.toJSON() as UnsignedSharedKey]),
    ),
  };
}

async function initializeOrgCrypto(
  client: PasswordManagerClient,
  orgKeys: Record<OrganizationId, EncString>,
): Promise<void> {
  // Initialize even when empty to clear any existing org keys.
  await client.crypto().initialize_org_crypto(toSdkOrgCrypto(orgKeys));
}
