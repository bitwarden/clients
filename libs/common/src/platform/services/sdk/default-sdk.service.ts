import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  defer,
  Observable,
  share,
  shareReplay,
  ReplaySubject,
  timer,
  map,
  distinctUntilChanged,
  tap,
  switchMap,
  catchError,
  takeWhile,
  throwIfEmpty,
  firstValueFrom,
  filter,
  of,
} from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService, KdfConfigService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncString, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { PerfTrackGroup } from "@bitwarden/logging";
import { ManagedSettingsService } from "@bitwarden/managed-settings";
import {
  PasswordManagerClient,
  ClientSettings,
  TokenProvider,
  UnsignedSharedKey,
  WrappedAccountCryptographicState,
  Kdf,
  V2UpgradeToken,
} from "@bitwarden/sdk-internal";

import { ApiService } from "../../../abstractions/api.service";
import { AccountInfo, AccountService } from "../../../auth/abstractions/account.service";
import { TokenService } from "../../../auth/abstractions/token.service";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { AccountCryptographicStateService } from "../../../key-management/account-cryptography/account-cryptographic-state.service";
import { JsWasmStateBridge } from "../../../key-management/state-bridge";
import { V2UpgradeTokenStateService } from "../../../key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { OrganizationId, UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { AppIdService } from "../../abstractions/app-id.service";
import { ConfigService } from "../../abstractions/config/config.service";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
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
import { StateProvider } from "../../state";
import { toSdkFeatureFlags } from "../config/default-config.service";

import { initializeClientManagedState } from "./client-managed-state";

/**
 * A token provider that exposes the access token to the SDK.
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

const LIFETIME_TRACK_GROUP = PerfTrackGroup.Sdk;
const LIFETIME_TRACK = "Lifetime";
const CRYPTO_TRACK_GROUP = PerfTrackGroup.Unlock;
const CRYPTO_TRACK = "Crypto";

export class DefaultSdkService implements SdkService {
  private sdkClientCache = new Map<UserId, Observable<Rc<PasswordManagerClient>>>();

  /**
   * The live per-user clients of the long-lived path. A client exists while its user has an
   * access token, and is removed on logout.
   */
  private clients$ = new BehaviorSubject<{
    [userId: UserId]: Rc<PasswordManagerClient> | undefined;
  }>({});
  /** Dedupes concurrent token-only client builds for the same user. */
  private creating = new Map<UserId, Promise<void>>();
  /** Bumped on every logout and token removal, so a build that started before is never published. */
  private logouts = new Map<UserId, number>();
  /** The rollout flag, captured per user on first use and kept for the life of the service. */
  private enabled = new Map<UserId, Promise<boolean>>();
  private readySubjects = new Map<UserId, BehaviorSubject<boolean>>();
  /** Users whose access token is watched to create and remove their client. */
  private watchedUsers = new Set<UserId>();
  /**
   * Clients that may hold user keys. Only these need clearing before an unlock: clearing also
   * clears the user key in state, which another process of the same client may already rely on.
   */
  private keyedClients = new WeakSet<PasswordManagerClient>();
  /** Bumped on every lock, logout and token removal. See {@link lockEpoch}. */
  private lockEpochs = new Map<UserId, number>();
  /** The lock epoch at which each user's client last finished unlocking its user crypto. */
  private unlockedAtEpoch = new Map<UserId, number>();

  client$ = this.environmentService.environment$.pipe(
    concatMap(async (env) => {
      await SdkLoadService.Ready;
      const settings = await this.toSettings(env);
      const managedSettings = await firstValueFrom(this.managedSettingsService.client$);
      const client = await this.sdkClientFactory.createSdkClient(
        new JsTokenProvider(this.apiServiceProvider),
        settings,
        managedSettings,
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
    protected accountService: AccountService,
    private kdfConfigServiceProvider: () => KdfConfigService,
    protected keyServiceProvider: () => KeyService,
    private accountCryptographyStateServiceProvider: () => AccountCryptographicStateService,
    private apiServiceProvider: () => ApiService,
    protected stateProvider: StateProvider,
    private configServiceProvider: () => ConfigService,
    private v2UpgradeTokenStateService: V2UpgradeTokenStateService,
    private managedSettingsService: ManagedSettingsService,
    private appIdService: AppIdService,
    private logService: LogService,
    private tokenServiceProvider: () => TokenService,
    private userAgent: string | null = null,
  ) {
    // Deferred to a microtask: `accounts$` can replay synchronously on subscribe, and resolving a
    // lazy dependency mid-construction is a DI cycle in Angular and an undefined field in the
    // CLI and browser background.
    this.accountService.accounts$.subscribe(
      (accounts) => void Promise.resolve().then(() => this.watchUsers(accounts)),
    );
  }

  userClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    return defer(() => this.longLivedEnabled(userId)).pipe(
      switchMap((longLived) =>
        longLived ? this.longLivedUserClient$(userId) : this.legacyUserClient$(userId),
      ),
    );
  }

  cryptoReady$(userId: UserId): Observable<boolean> {
    // Per-user clients of the reactive path are rebuilt from the same state their consumers read,
    // so there is no window in which the state shows a user key that the client cannot decrypt with.
    return defer(() => this.longLivedEnabled(userId)).pipe(
      switchMap((longLived) =>
        longLived ? this.cryptoReadySubject(userId).asObservable() : of(true),
      ),
      distinctUntilChanged(),
    );
  }

  /**
   * Unlocks the user crypto of the user's live client. Organization keys follow in
   * {@link setOrgKeys}.
   */
  async unlock(userId: UserId, request: SdkUnlockRequest): Promise<UserKey | null> {
    return this.unlockAtEpoch(userId, request, this.lockEpoch(userId));
  }

  /**
   * {@link unlock}, for an unlock whose decision to unlock was made at the given lock epoch. If
   * the user is locked or logged out after that, the unlock clears the client and rejects rather
   * than leaving keys behind a lock that has already run.
   */
  protected async unlockAtEpoch(
    userId: UserId,
    request: SdkUnlockRequest,
    epoch: number,
  ): Promise<UserKey | null> {
    // `null` makes the caller fall back to unlocking through a register client.
    if (!(await this.longLivedEnabled(userId))) {
      return null;
    }

    await this.ensureClient(userId);

    const [v2UpgradeToken, accounts, kdfConfig] = await Promise.all([
      firstValueFrom(this.v2UpgradeTokenStateService.v2UpgradeToken$(userId)),
      firstValueFrom(this.accountService.accounts$),
      firstValueFrom(this.kdfConfigServiceProvider().getKdfConfig$(userId)),
    ]);
    const email = accounts[userId]?.email;
    if (email == null || kdfConfig == null) {
      throw new Error(`Failed to unlock the SDK client for user (${userId})`);
    }

    let userKey: UserKey | undefined;
    await this.withClient(userId, async (client) => {
      // An unlock that a lock already overtook must not touch the client: it may belong to a
      // newer unlock by now, and initializing would write the user key back to state.
      if (this.lockEpoch(userId) !== epoch) {
        throw new Error(`User (${userId}) was locked while unlocking the SDK client`);
      }
      // Not ready from the moment the keys are cleared. A failure after this point leaves the
      // client locked, which consumers see as a lock.
      this.cryptoReadySubject(userId).next(false);
      // A client that still holds keys hard-errors `CryptoInitialization` on initialization.
      if (this.keyedClients.has(client)) {
        await this.clearKeys(client);
      }
      this.keyedClients.add(client);
      await client.crypto().initialize_user_crypto({
        ...request,
        email,
        kdfParams: kdfConfig.toSdkConfig(),
        upgradeToken: v2UpgradeToken ?? undefined,
      });
      // Initializing also wrote the user key to state, so a lock that ran meanwhile is undone
      // unless the keys are cleared again.
      if (this.lockEpoch(userId) !== epoch) {
        await this.clearKeys(client);
        throw new Error(`User (${userId}) was locked while unlocking the SDK client`);
      }
      this.unlockedAtEpoch.set(userId, epoch);
      userKey = SymmetricCryptoKey.fromString(
        await client.crypto().get_user_encryption_key(),
      ) as UserKey;
    });

    if (userKey == null) {
      throw new Error(`Failed to unlock the SDK client for user (${userId})`);
    }
    return userKey;
  }

  /**
   * Clears the keys of the user's live client. The client instance is kept, so a later
   * {@link unlock} re-initializes the same instance.
   *
   * Never rejects: the lock service wipes the rest of the user's decrypted state after this
   * resolves, and a rejection would leave the vault unlocked.
   */
  async lock(userId: UserId): Promise<void> {
    // Bumped first and even without a client, so an unlock already in flight sees the lock.
    this.bumpLockEpoch(userId);
    if (!(await this.longLivedEnabled(userId))) {
      return;
    }

    this.cryptoReadySubject(userId).next(false);
    try {
      await this.withClient(userId, (client) => this.clearKeys(client));
    } catch (e) {
      this.logService.error(`Failed to lock the SDK client for user (${userId})`, e);
    }
  }

  /**
   * Returns void: the logout service does not await it, so the flag is resolved in a `.then`.
   */
  logout(userId: UserId): void {
    this.logouts.set(userId, (this.logouts.get(userId) ?? 0) + 1);
    this.bumpLockEpoch(userId);
    void this.longLivedEnabled(userId).then((longLived) => {
      if (longLived) {
        this.removeClient(userId);
      }
    });
  }

  /** Ungated: there is no live client to update on the reactive path, so `withClient` no-ops. */
  async setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void> {
    await this.withClient(userId, (client) => client.platform().load_flags(flags));
  }

  /**
   * The completion point of every unlock: once the keys are applied, the client is ready.
   *
   * Fails closed: if the keys cannot be applied to a client that is not ready yet, the client is
   * locked, so the unlock ends in a lock rather than an unlocked user whose client never becomes
   * ready. A failure on a client that is already ready leaves it as it is.
   */
  async setOrgKeys(
    userId: UserId,
    orgKeys: Record<OrganizationId, UnsignedSharedKey>,
  ): Promise<void> {
    if (!(await this.longLivedEnabled(userId))) {
      return;
    }

    await this.withClient(userId, async (client) => {
      // A locked client gets its organization keys from the unlock that follows.
      if (!this.keyedClients.has(client)) {
        return;
      }

      const unlockedAt = this.unlockedAtEpoch.get(userId);
      try {
        await client.crypto().initialize_org_crypto({
          organizationKeys: new Map(Object.entries(orgKeys).map(([k, v]) => [asUuid(k), v])),
        });
      } catch (e) {
        if (!this.cryptoReadySubject(userId).value) {
          try {
            await this.clearKeys(client);
          } catch (lockError) {
            this.logService.error(`Failed to lock the SDK client for user (${userId})`, lockError);
          }
        }
        throw e;
      }
      if (unlockedAt !== this.lockEpoch(userId)) {
        await this.clearKeys(client);
        throw new Error(`User (${userId}) was locked while applying organization keys`);
      }
      this.cryptoReadySubject(userId).next(true);
    });
  }

  /**
   * Increases on every lock, logout and token removal of the user, whether or not a client
   * exists. An unlock that started at an earlier epoch must not leave keys behind.
   */
  protected lockEpoch(userId: UserId): number {
    return this.lockEpochs.get(userId) ?? 0;
  }

  private bumpLockEpoch(userId: UserId): void {
    this.lockEpochs.set(userId, this.lockEpoch(userId) + 1);
  }

  /**
   * Whether the user is on the long-lived client path. A failed flag lookup lands on the
   * reactive path.
   */
  protected longLivedEnabled(userId: UserId): Promise<boolean> {
    let enabled = this.enabled.get(userId);
    if (enabled == null) {
      enabled = firstValueFrom(
        defer(() =>
          this.configServiceProvider().userCachedFeatureFlag$(
            FeatureFlag.PM31844_LongLivedSdkClient,
            userId,
          ),
        ),
      ).catch(() => false);
      this.enabled.set(userId, enabled);
    }
    return enabled;
  }

  /**
   * Starts from false and outlives the client, so a user who logs in again starts not ready.
   */
  private cryptoReadySubject(userId: UserId): BehaviorSubject<boolean> {
    let subject = this.readySubjects.get(userId);
    if (subject == null) {
      subject = new BehaviorSubject(false);
      this.readySubjects.set(userId, subject);
    }
    return subject;
  }

  /**
   * Watches the access token of every account: a token appearing (login) creates the user's
   * client, and a token disappearing removes it. The token is also what covers logouts that do
   * not call {@link logout}.
   */
  private watchUsers(accounts: Record<UserId, AccountInfo>): void {
    for (const userId of Object.keys(accounts) as UserId[]) {
      if (this.watchedUsers.has(userId)) {
        continue;
      }
      this.watchedUsers.add(userId);

      this.loggedIn$(userId)
        .pipe(
          concatMap(async (loggedIn) => {
            if (!loggedIn) {
              // Only a long-lived user ever has a client, so this is inert on the reactive path.
              this.logouts.set(userId, (this.logouts.get(userId) ?? 0) + 1);
              this.bumpLockEpoch(userId);
              this.removeClient(userId);
              return;
            }

            if (await this.longLivedEnabled(userId)) {
              this.ensureClient(userId).catch((e) =>
                this.logService.error(`Failed to create the SDK client for user (${userId})`, e),
              );
            }
          }),
        )
        .subscribe({
          error: (e: unknown) =>
            this.logService.error(`Failed to watch the access token of user (${userId})`, e),
        });
    }
  }

  private loggedIn$(userId: UserId): Observable<boolean> {
    return defer(() => this.tokenServiceProvider().hasAccessToken$(userId)).pipe(
      distinctUntilChanged(),
    );
  }

  private removeClient(userId: UserId): void {
    this.cryptoReadySubject(userId).next(false);
    if (this.clients$.value[userId] != null) {
      this.publish(userId, undefined);
    }
  }

  private legacyUserClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    return this.internalClient$(userId).pipe(
      takeWhile((client) => client !== undefined, false),
      // Filter out clients that have been marked for disposal. This can happen in the
      // race window where `internalClient$`'s `combineLatest` re-emits (e.g. during
      // unlock when org keys / user key re-emit): the previous inner Observable's
      // cleanup marks the old Rc for disposal before the new client finishes its
      // async initialization, leaving the shared ReplaySubject holding a disposed
      // reference that would otherwise throw on `take()`.
      filter((client) => !client.isMarkedForDisposal),
      throwIfEmpty(() => new UserNotLoggedInError(userId)),
    );
  }

  /**
   * Waits while the client is being built, errors with {@link UserNotLoggedInError} when the user
   * has no access token, and completes when the token is removed (logout). Unsubscribing never
   * disposes the client.
   */
  private longLivedUserClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    return combineLatest([this.loggedIn$(userId), this.clients$]).pipe(
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

  /** Idempotent, and dedupes concurrent builds. The only path to a new long-lived client. */
  private ensureClient(userId: UserId): Promise<void> {
    if (this.clients$.value[userId] != null) {
      return Promise.resolve();
    }

    let creation = this.creating.get(userId);
    if (creation == null) {
      const logouts = this.logouts.get(userId);
      creation = this.buildTokenOnlyClient(userId)
        .then(async (client) => {
          const loggedIn = await firstValueFrom(this.loggedIn$(userId));
          if (
            loggedIn &&
            this.logouts.get(userId) === logouts &&
            this.clients$.value[userId] == null
          ) {
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

  /** Builds a client that can make authenticated requests but holds no keys. */
  private async buildTokenOnlyClient(userId: UserId): Promise<PasswordManagerClient> {
    await SdkLoadService.Ready;
    const env = await firstValueFrom(this.environmentService.getEnvironment$(userId));
    const settings = await this.toSettings(env);
    const managedSettings = await firstValueFrom(this.managedSettingsService.client$);
    const client = await this.sdkClientFactory.createSdkClient(
      new JsTokenProvider(this.apiServiceProvider, userId),
      settings,
      managedSettings,
    );
    try {
      await this.initializeClient(userId, client);
    } catch (e) {
      client.free();
      throw e;
    }
    return client;
  }

  /** The SDK clears its in-memory keys before anything that can fail, so the client is unkeyed. */
  private async clearKeys(client: PasswordManagerClient): Promise<void> {
    this.keyedClients.delete(client);
    await client.unlock().lock();
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

  private publish(userId: UserId, rc: Rc<PasswordManagerClient> | undefined) {
    const previous = this.clients$.value[userId];
    this.clients$.next({ ...this.clients$.value, [userId]: rc });
    previous?.markForDisposal();
  }

  /**
   * Creates a client for a specific user by using the existing state of the application.
   * @param userId The user id for which to create the client
   * @returns An observable that emits the client for the user
   */
  private internalClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    const cached = this.sdkClientCache.get(userId);
    if (cached !== undefined) {
      return cached;
    }

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
    const keyService = this.keyServiceProvider();
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
              const managedSettings = await firstValueFrom(this.managedSettingsService.client$);

              const createMeasurement = this.logService.startMeasurement(
                LIFETIME_TRACK_GROUP,
                LIFETIME_TRACK,
                "create",
              );
              const client = await this.sdkClientFactory.createSdkClient(
                new JsTokenProvider(this.apiServiceProvider, userId),
                settings,
                managedSettings,
              );
              createMeasurement.finish();
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

            return () => {
              if (client == null) {
                return;
              }

              const disposeMeasurement = this.logService.startMeasurement(
                LIFETIME_TRACK_GROUP,
                LIFETIME_TRACK,
                "dispose",
              );
              client.markForDisposal();
              disposeMeasurement.finish();
            };
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
    const userCryptoMeasurement = this.logService.startMeasurement(
      CRYPTO_TRACK_GROUP,
      CRYPTO_TRACK,
      "Decrypt User Keys",
    );
    await client.crypto().initialize_user_crypto({
      userId: asUuid(userId),
      email: account.email,
      method: { clientManagedState: {} },
      kdfParams: kdf,
      accountCryptographicState: accountCryptographicState,
      upgradeToken: v2UpgradeToken ?? undefined,
    });
    userCryptoMeasurement.finish();

    // We initialize the org crypto even if the org_keys are
    // null to make sure any existing org keys are cleared.
    const orgCryptoMeasurement = this.logService.startMeasurement(
      CRYPTO_TRACK_GROUP,
      CRYPTO_TRACK,
      "Decrypt Organization Keys",
    );
    await client.crypto().initialize_org_crypto({
      organizationKeys: new Map(
        Object.entries(orgKeys).map(([k, v]) => [asUuid(k), v.toJSON() as UnsignedSharedKey]),
      ),
    });
    orgCryptoMeasurement.finish([["Organizations", Object.keys(orgKeys).length]]);
  }

  private async loadFeatureFlags(client: PasswordManagerClient) {
    const serverConfig = await firstValueFrom(this.configServiceProvider().serverConfig$);
    await client.platform().load_flags(toSdkFeatureFlags(serverConfig));
  }

  private async toSettings(env: Environment): Promise<ClientSettings> {
    return {
      apiUrl: env.getApiUrl(),
      identityUrl: env.getIdentityUrl(),
      deviceType: toSdkDevice(this.platformUtilsService.getDevice()),
      deviceIdentifier: await this.appIdService.getAppId(),
      bitwardenClientVersion: await this.platformUtilsService.getApplicationVersionNumber(),
      userAgent: this.userAgent ?? navigator.userAgent,
    };
  }
}
