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
  of,
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
// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import {
  PasswordManagerClient,
  ClientSettings,
  TokenProvider,
  UnsignedSharedKey,
  WrappedAccountCryptographicState,
  Kdf,
  V2UpgradeToken,
  InitOrgCryptoRequest,
} from "@bitwarden/sdk-internal";

import { ApiService } from "../../../abstractions/api.service";
import { AccountInfo, AccountService } from "../../../auth/abstractions/account.service";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { AccountCryptographicStateService } from "../../../key-management/account-cryptography/account-cryptographic-state.service";
import { JsWasmStateBridge } from "../../../key-management/state-bridge";
import { V2UpgradeTokenStateService } from "../../../key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { OrganizationId, UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { ConfigService } from "../../abstractions/config/config.service";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import {
  asUuid,
  SdkService,
  SdkUnlockRequest,
  toSdkDevice,
  UserNotLoggedInError,
} from "../../abstractions/sdk/sdk.service";
import { compareValues } from "../../misc/compare-values";
import { Rc } from "../../misc/reference-counting/rc";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";
import { StateProvider } from "../../state";
import { toSdkFeatureFlags } from "../config/default-config.service";

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

  /**
   * Per-user "this client can decrypt" flag backing {@link cryptoReady$}. Starts `false`: a token-only
   * client cannot decrypt, and in the browser the background process sees `USER_KEY` land in shared state
   * before the unlock push reaches it, so defaulting to `true` would let it start decrypting against a
   * client it has not unlocked yet.
   */
  private cryptoReady = new Map<UserId, BehaviorSubject<boolean>>();

  // --- legacy path (flag off) ---
  private sdkClientCache = new Map<UserId, Observable<Rc<PasswordManagerClient>>>();

  // --- rollout flag, captured once per user ---
  private enabled = new Map<UserId, Promise<boolean>>();

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
    // `protected`: the browser subclass enumerates accounts to converge a freshly-started process.
    protected accountService: AccountService,
    // These are resolved lazily (functions) so this service can be constructed before them (cli/browser
    // construct it early) and so the services that push into it can inject it without a construction
    // cycle. Most are touched only when the reactive `internalClient$` is subscribed, so they go away with
    // the legacy path — but `kdfConfigServiceProvider` does not: `unlock` resolves the KDF config on the
    // long-lived path too, so it outlives the flag.
    private kdfConfigServiceProvider: () => KdfConfigService,
    // `protected`: the browser subclass rebuilds the unlock payload when converging.
    protected keyServiceProvider: () => KeyService,
    private accountCryptographyStateServiceProvider: () => AccountCryptographicStateService,
    private apiServiceProvider: () => ApiService,
    // `protected`: the browser subclass reads the persisted server config when converging.
    protected stateProvider: StateProvider,
    private configServiceProvider: () => ConfigService,
    private v2UpgradeTokenStateService: V2UpgradeTokenStateService,
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
          for (const userId of Object.keys(accounts) as UserId[]) {
            if (await this.longLivedEnabled(userId)) {
              void this.ensureClient(userId);
            }
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
   *
   * A failed lookup resolves to `false` rather than rejecting: the session then runs the legacy path
   * for its lifetime, which is the safe default. Without this, the memoized rejection would fail every
   * `userClient$` subscription and every push for the rest of the process.
   */
  /**
   * Resolve the rollout flag from the user's **cached** server config, once per user.
   *
   * Deliberately not `ConfigService.getFeatureFlag`. That reads `serverConfig$`, which returns `NEVER`
   * while it refreshes a stale config and only recovers once the refreshed config is persisted. Persisting
   * it runs `renewConfig`, which pushes the new flags into this service, and those pushes await this
   * method. The result is a cycle: the flag waits for the config, the config waits for the push, the push
   * waits for the flag. Nothing in this service may depend on a `ConfigService` read that can trigger a
   * refresh.
   *
   * `userCachedFeatureFlag$` reads `USER_SERVER_CONFIG` and the override state directly. Both are plain
   * state observables that resolve from storage and emit, so this cannot stall. The trade-off is that a
   * session with no cached config yet resolves to the flag's default and runs the legacy path until the
   * config lands, which fails to the safe side.
   */
  protected longLivedEnabled(userId: UserId): Promise<boolean> {
    let enabled = this.enabled.get(userId);
    if (enabled == null) {
      enabled = firstValueFrom(
        this.configServiceProvider().userCachedFeatureFlag$(
          FeatureFlag.PM31845_LongLivedSdkClient,
          userId,
        ),
      ).catch(() => false);
      this.enabled.set(userId, enabled);
    }
    return enabled;
  }

  userClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    return defer(() => this.longLivedEnabled(userId)).pipe(
      switchMap((longLived) =>
        longLived ? this.longLivedUserClient$(userId) : this.legacyUserClient$(userId),
      ),
    );
  }

  /**
   * Initialize user crypto on the user's existing client, from a derived key (`method: decryptedKey`) or
   * from a credential (master password, PIN, biometrics, …). Driven by the unlock flow. Re-invoking for a
   * key rotation is an in-place mutation, not a rebuild. No-op — `null` — while the flag is off, where the
   * reactive path drives unlock instead.
   *
   * Organization keys follow through {@link setOrgKeys}, which is what completes the unlock and flips
   * {@link cryptoReady$}. Every caller must reach it.
   *
   * Returns the key the client is now unlocked with, read back from the client itself, so a credential
   * caller does not have to re-derive it. Throws if the unlock could not be applied; see the null check
   * below for why that is not signalled as `null`.
   */
  async unlock(userId: UserId, request: SdkUnlockRequest): Promise<UserKey | null> {
    if (!(await this.longLivedEnabled(userId))) {
      return null;
    }
    // The client is mid-rebuild from here until `setOrgKeys` completes it, so nothing may decrypt against it.
    this.cryptoReadySubject(userId).next(false);
    await this.ensureClient(userId);
    // Supplied here rather than by the caller: these are account-scoped facts, not unlock inputs, so every
    // caller would otherwise resolve the same three values from the same sources, and one that forgot any of
    // them would silently change how the client unlocks (skipping the V2 upgrade, or deriving against the
    // wrong KDF). Resolving them once here is also what lets `KeyService` stay a state-management service:
    // it holds neither `AccountService` nor `KdfConfigService` since #22319.
    const [v2UpgradeToken, accounts, kdfConfig] = await Promise.all([
      firstValueFrom(this.v2UpgradeTokenStateService.v2UpgradeToken$(userId)),
      firstValueFrom(this.accountService.accounts$),
      firstValueFrom(this.kdfConfigServiceProvider().getKdfConfig$(userId)),
    ]);
    const email = accounts[userId]?.email;
    if (email == null || kdfConfig == null) {
      // Same failure class as the no-client case below, so callers can treat "could not unlock" as one
      // thing: throwing rather than returning null keeps a credential caller off the register-client
      // fallback. A not-logged-in user reaches this first, since they have no account to read an email from.
      throw new Error(
        `Failed to unlock the SDK client for user (${userId}): missing ${email == null ? "email" : "KDF config"}`,
      );
    }
    let userKey: UserKey | undefined;
    await this.withClient(userId, async (client) => {
      // Clear before initializing: a long-lived client gets re-unlocked on the same instance, and
      // `initialize_user_crypto` hard-errors `CryptoInitialization` against a keystore that already holds
      // user, private or signing keys.
      //
      // The keystore is observably empty between the clear and the key install. That window is not closed
      // by doing this in the SDK instead: `initialize_user_crypto` awaits `init_user_id` into us through
      // the state bridge before it installs anything, so the round trip dominates either way. What keeps
      // it safe is `cryptoReady$`, which holds the vault decrypt batch until `setOrgKeys` completes.
      //
      // A `decryptedKey` method is copied back to USER_KEY state by the SDK (a harmless redundant write
      // while the caller still writes it; dropped at cleanup). Do NOT switch to clientManagedState
      // (stale-read risk on the setUserKey/rotation path).
      client.crypto().lock();
      await client.crypto().initialize_user_crypto({
        ...request,
        email,
        kdfParams: kdfConfig.toSdkConfig(),
        upgradeToken: v2UpgradeToken ?? undefined,
      });
      // Read back rather than echoing the request: for a credential method this is the only way to learn
      // the derived key, and for `decryptedKey` it is the same key the caller passed in.
      userKey = SymmetricCryptoKey.fromString(
        await client.crypto().get_user_encryption_key(),
      ) as UserKey;
    });
    if (userKey == null) {
      // `withClient` no-ops when the client is missing or already disposed, e.g. a logout that raced the
      // unlock. Returning null would read as "flag off" and send a credential caller to the register-client
      // fallback — the racing path this replaces — so fail loudly instead.
      throw new Error(`Failed to unlock the SDK client for user (${userId})`);
    }
    return userKey;
  }

  cryptoReady$(userId: UserId): Observable<boolean> {
    return defer(() => this.longLivedEnabled(userId)).pipe(
      // Flag off: the reactive path rebuilds the client from the same state the consumers read, so there
      // is no window to gate and no signal to publish.
      switchMap((longLived) =>
        longLived ? this.cryptoReadySubject(userId).asObservable() : of(true),
      ),
      distinctUntilChanged(),
    );
  }

  private cryptoReadySubject(userId: UserId): BehaviorSubject<boolean> {
    let subject = this.cryptoReady.get(userId);
    if (subject == null) {
      subject = new BehaviorSubject<boolean>(false);
      this.cryptoReady.set(userId, subject);
    }
    return subject;
  }

  /**
   * Clear the in-memory user key in place, retaining the client instance across lock → unlock. Driven
   * by `LockService.lock`, which also triggers a process reload as defense in depth. No-op while the
   * flag is off (the reactive path drives lock).
   */
  async lock(userId: UserId): Promise<void> {
    if (!(await this.longLivedEnabled(userId))) {
      return;
    }
    this.cryptoReadySubject(userId).next(false);
    await this.withClient(userId, (client) => Promise.resolve(client.crypto().lock()));
  }

  /**
   * Dispose the client and complete `userClient$` (which also completes when the account leaves
   * `accounts$`). No-op while the flag is off (the reactive path tears down on its own).
   */
  logout(userId: UserId): void {
    void this.longLivedEnabled(userId).then((longLived) => {
      if (!longLived) {
        return;
      }
      this.cryptoReadySubject(userId).next(false);
      this.publish(userId, undefined);
    });
  }

  /** Apply feature flags to the user's live client. Driven by `ConfigService`. No-op while the flag is off. */
  async setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void> {
    // Deliberately not gated. `ConfigService.renewConfig` awaits this push, so any gate here is on the
    // hot path of a config refresh. The gate would be redundant anyway: `clients$` is only populated on
    // the long-lived path, so `withClient` no-ops when it finds nothing.
    await this.withClient(userId, (client) => client.platform().load_flags(flags));
  }

  /**
   * Apply organization keys to the user's live client. Driven by `KeyService`. No-op while the flag is off.
   * Callers push only once the user key exists, so the client is always unlocked here.
   *
   * This is the completion point for the credential unlock paths, which cannot build org keys until the
   * user key exists: it is what flips {@link cryptoReady$} true for them.
   */
  async setOrgKeys(userId: UserId, orgKeys: Record<OrganizationId, EncString>): Promise<void> {
    if (!(await this.longLivedEnabled(userId))) {
      return;
    }
    await this.withClient(userId, async (client) => {
      await client.crypto().initialize_org_crypto(toSdkOrgCrypto(orgKeys));
      this.cryptoReadySubject(userId).next(true);
    });
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
    const v2UpgradeToken$ = this.v2UpgradeTokenStateService
      .v2UpgradeToken$(userId)
      .pipe(distinctUntilChanged());

    const client$ = combineLatest([
      this.environmentService.getEnvironment$(userId),
      account$,
      kdfParams$,
      accountCryptographicState$,
      userKey$,
      orgKeys$,
      v2UpgradeToken$,
      SdkLoadService.Ready, // Makes sure we wait (once) for the SDK to be loaded
    ]).pipe(
      // switchMap is required to allow the clean-up logic to be executed when `combineLatest` emits a new value.
      switchMap(
        ([
          env,
          account,
          kdfParams,
          accountCryptographicState,
          userKey,
          orgKeys,
          v2UpgradeToken,
        ]) => {
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
                v2UpgradeToken,
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
        },
      ),
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
    v2UpgradeToken: V2UpgradeToken | null,
  ) {
    await client.crypto().initialize_user_crypto({
      userId: asUuid(userId),
      email: account.email,
      method: { clientManagedState: {} },
      kdfParams: kdf,
      accountCryptographicState: accountCryptographicState,
      upgradeToken: v2UpgradeToken ?? undefined,
    });

    // We initialize the org crypto even if the org_keys are
    // null to make sure any existing org keys are cleared.
    await client.crypto().initialize_org_crypto(toSdkOrgCrypto(orgKeys));
  }

  private async loadFeatureFlags(client: PasswordManagerClient) {
    const serverConfig = await firstValueFrom(this.configServiceProvider().serverConfig$);
    await client.platform().load_flags(toSdkFeatureFlags(serverConfig));
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
