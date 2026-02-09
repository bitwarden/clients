import {
  combineLatest,
  concatMap,
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
  BehaviorSubject,
  of,
  takeWhile,
  throwIfEmpty,
  firstValueFrom,
} from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserKey } from "@bitwarden/common/types/key";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService, KdfConfigService, KdfConfig, KdfType } from "@bitwarden/key-management";
import {
  PasswordManagerClient,
  ClientSettings,
  TokenProvider,
  UnsignedSharedKey,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";

import { ApiService } from "../../../abstractions/api.service";
import { AccountInfo, AccountService } from "../../../auth/abstractions/account.service";
import { AccountCryptographicStateService } from "../../../key-management/account-cryptography/account-cryptographic-state.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { OrganizationId, UserId } from "../../../types/guid";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import {
  asUuid,
  SdkService,
  toSdkDevice,
  UserNotLoggedInError,
} from "../../abstractions/sdk/sdk.service";
import { compareValues } from "../../misc/compare-values";
import { Rc } from "../../misc/reference-counting/rc";
import { StateProvider } from "../../state";

import { initializeState } from "./client-managed-state";

// A symbol that represents an overridden client that is explicitly set to undefined,
// blocking the creation of an internal client for that user.
const UnsetClient = Symbol("UnsetClient");

/**
 * A token provider that exposes the access token to the SDK.
 */
class JsTokenProvider implements TokenProvider {
  constructor(
    private apiService: ApiService,
    private userId?: UserId,
  ) {}

  async get_access_token(): Promise<string | undefined> {
    if (this.userId == null) {
      return undefined;
    }

    return await this.apiService.getActiveBearerToken(this.userId);
  }
}

export class DefaultSdkService implements SdkService {
  private sdkClientOverrides = new BehaviorSubject<{
    [userId: UserId]: Rc<PasswordManagerClient> | typeof UnsetClient;
  }>({});
  private sdkClientCache = new Map<UserId, Observable<Rc<PasswordManagerClient>>>();

  client$ = this.environmentService.environment$.pipe(
    concatMap(async (env) => {
      await SdkLoadService.Ready;
      const settings = await this.toSettings(env);
      const client = await this.sdkClientFactory.createSdkClient(
        new JsTokenProvider(this.apiService),
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
    private kdfConfigService: KdfConfigService,
    private keyService: KeyService,
    private accountCryptographyStateService: AccountCryptographicStateService,
    private apiService: ApiService,
    private stateProvider: StateProvider,
    private configService: ConfigService,
    private userAgent: string | null = null,
  ) {}

  userClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    return this.sdkClientOverrides.pipe(
      takeWhile((clients) => clients[userId] !== UnsetClient, false),
      map((clients) => {
        if (clients[userId] === UnsetClient) {
          throw new Error("Encountered UnsetClient even though it should have been filtered out");
        }
        return clients[userId] as Rc<PasswordManagerClient>;
      }),
      distinctUntilChanged(),
      switchMap((clientOverride) => {
        if (clientOverride) {
          return of(clientOverride);
        }

        return this.internalClient$(userId);
      }),
      takeWhile((client) => client !== undefined, false),
      throwIfEmpty(() => new UserNotLoggedInError(userId)),
    );
  }

  setClient(userId: UserId, client: PasswordManagerClient | undefined) {
    const previousValue = this.sdkClientOverrides.value[userId];

    this.sdkClientOverrides.next({
      ...this.sdkClientOverrides.value,
      [userId]: client ? new Rc(client) : UnsetClient,
    });

    if (previousValue !== UnsetClient && previousValue !== undefined) {
      previousValue.markForDisposal();
    }
  }

  /**
   * This method is used to create a client for a specific user by using the existing state of the application.
   * This methods is a fallback for when no client has been provided by Auth. As Auth starts implementing the
   * client creation, this method will be deprecated.
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
    const kdfParams$ = this.kdfConfigService.getKdfConfig$(userId).pipe(distinctUntilChanged());
    const accountCryptographicState$ = this.accountCryptographyStateService
      .accountCryptographicState$(userId)
      .pipe(distinctUntilChanged());
    const userKey$ = this.keyService.userKey$(userId).pipe(distinctUntilChanged());
    const orgKeys$ = this.keyService.encryptedOrgKeys$(userId).pipe(
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
            if (
              env == null ||
              kdfParams == null ||
              accountCryptographicState == null ||
              userKey == null
            ) {
              return undefined;
            }

            const settings = await this.toSettings(env);
            const client = await this.sdkClientFactory.createSdkClient(
              new JsTokenProvider(this.apiService, userId),
              settings,
            );

            await this.initializeClient(
              userId,
              client,
              account,
              kdfParams,
              userKey,
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

  private async initializeClient(
    userId: UserId,
    client: PasswordManagerClient,
    account: AccountInfo,
    kdfParams: KdfConfig,
    userKey: UserKey,
    accountCryptographicState: WrappedAccountCryptographicState,
    orgKeys: Record<OrganizationId, EncString>,
  ) {
    await client.crypto().initialize_user_crypto({
      userId: asUuid(userId),
      email: account.email,
      method: { decryptedKey: { decrypted_user_key: userKey.keyB64 } },
      kdfParams:
        kdfParams.kdfType === KdfType.PBKDF2_SHA256
          ? { pBKDF2: { iterations: kdfParams.iterations } }
          : {
              argon2id: {
                iterations: kdfParams.iterations,
                memory: kdfParams.memory,
                parallelism: kdfParams.parallelism,
              },
            },
      accountCryptographicState: accountCryptographicState,
    });

    // We initialize the org crypto even if the org_keys are
    // null to make sure any existing org keys are cleared.
    await client.crypto().initialize_org_crypto({
      organizationKeys: new Map(
        Object.entries(orgKeys).map(([k, v]) => [asUuid(k), v.toJSON() as UnsignedSharedKey]),
      ),
    });

    // Initialize the SDK managed database and the client managed repositories.
    await initializeState(userId, client.platform().state(), this.stateProvider);

    await this.loadFeatureFlags(client);
  }

  private async loadFeatureFlags(client: PasswordManagerClient) {
    const serverConfig = await firstValueFrom(this.configService.serverConfig$);

    const featureFlagMap = new Map(
      Object.entries(serverConfig?.featureStates ?? {})
        .filter(([, value]) => typeof value === "boolean") // The SDK only supports boolean feature flags at this time
        .map(([key, value]) => [key, value] as [string, boolean]),
    );

    client.platform().load_flags(featureFlagMap);
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
