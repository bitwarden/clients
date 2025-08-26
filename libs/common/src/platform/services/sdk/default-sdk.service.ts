import {
  combineLatest,
  concatMap,
  Observable,
  shareReplay,
  map,
  distinctUntilChanged,
  tap,
  switchMap,
  catchError,
  BehaviorSubject,
  of,
  takeWhile,
  throwIfEmpty,
} from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService, KdfConfigService, KdfConfig, KdfType } from "@bitwarden/key-management";
import {
  BitwardenClient,
  ClientSettings,
  DeviceType as SdkDeviceType,
  TokenProvider,
  UnsignedSharedKey,
} from "@bitwarden/sdk-internal";

import { EncryptedOrganizationKeyData } from "../../../admin-console/models/data/encrypted-organization-key.data";
import { AccountInfo, AccountService } from "../../../auth/abstractions/account.service";
import { DeviceType } from "../../../enums/device-type.enum";
import { EncryptedString } from "../../../key-management/crypto/models/enc-string";
import { OrganizationId, UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import { SdkService, UserNotLoggedInError } from "../../abstractions/sdk/sdk.service";
import { compareValues } from "../../misc/compare-values";
import { Rc } from "../../misc/reference-counting/rc";
import { StateProvider } from "../../state";

import { initializeState } from "./client-managed-state";

// A symbol that represents an overriden client that is explicitly set to undefined,
// blocking the creation of an internal client for that user.
const UnsetClient = Symbol("UnsetClient");

/**
 * A token provider that exposes the access token to the SDK.
 */
class JsTokenProvider implements TokenProvider {
  constructor() {}

  async get_access_token(): Promise<string | undefined> {
    return undefined;
  }
}

export class DefaultSdkService implements SdkService {
  private sdkClientOverrides = new BehaviorSubject<{
    [userId: UserId]: Rc<BitwardenClient> | typeof UnsetClient;
  }>({});
  private sdkClientCache = new Map<UserId, Observable<Rc<BitwardenClient>>>();

  client$ = this.environmentService.environment$.pipe(
    concatMap(async (env) => {
      await SdkLoadService.Ready;
      const settings = this.toSettings(env);
      return await this.sdkClientFactory.createSdkClient(new JsTokenProvider(), settings);
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
    private stateProvider: StateProvider,
    private userAgent: string | null = null,
  ) {}

  userClient$(userId: UserId): Observable<Rc<BitwardenClient>> {
    return this.sdkClientOverrides.pipe(
      takeWhile((clients) => clients[userId] !== UnsetClient, false),
      map((clients) => {
        if (clients[userId] === UnsetClient) {
          throw new Error("Encountered UnsetClient even though it should have been filtered out");
        }
        return clients[userId] as Rc<BitwardenClient>;
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

  setClient(userId: UserId, client: BitwardenClient | undefined) {
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
  private internalClient$(userId: UserId): Observable<Rc<BitwardenClient>> {
    const cached = this.sdkClientCache.get(userId);
    if (cached !== undefined) {
      return cached;
    }

    const account$ = this.accountService.accounts$.pipe(
      map((accounts) => accounts[userId]),
      distinctUntilChanged(),
    );
    const kdfParams$ = this.kdfConfigService.getKdfConfig$(userId).pipe(distinctUntilChanged());
    const privateKey$ = this.keyService
      .userEncryptedPrivateKey$(userId)
      .pipe(distinctUntilChanged());
    const userKey$ = this.keyService.userKey$(userId).pipe(distinctUntilChanged());
    const orgKeys$ = this.keyService.encryptedOrgKeys$(userId).pipe(
      distinctUntilChanged(compareValues), // The upstream observable emits different objects with the same values
    );

    const client$ = combineLatest([
      this.environmentService.getEnvironment$(userId),
      account$,
      kdfParams$,
      privateKey$,
      userKey$,
      orgKeys$,
      SdkLoadService.Ready, // Makes sure we wait (once) for the SDK to be loaded
    ]).pipe(
      // switchMap is required to allow the clean-up logic to be executed when `combineLatest` emits a new value.
      switchMap(([env, account, kdfParams, privateKey, userKey, orgKeys]) => {
        // Create our own observable to be able to implement clean-up logic
        return new Observable<Rc<BitwardenClient>>((subscriber) => {
          const createAndInitializeClient = async () => {
            if (env == null || kdfParams == null || privateKey == null || userKey == null) {
              return undefined;
            }

            const settings = this.toSettings(env);
            const client = await this.sdkClientFactory.createSdkClient(
              new JsTokenProvider(),
              settings,
            );

            await this.initializeClient(
              userId,
              client,
              account,
              kdfParams,
              privateKey,
              userKey,
              orgKeys,
            );

            return client;
          };

          let client: Rc<BitwardenClient> | undefined;
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
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.sdkClientCache.set(userId, client$);
    return client$;
  }

  private async initializeClient(
    userId: UserId,
    client: BitwardenClient,
    account: AccountInfo,
    kdfParams: KdfConfig,
    privateKey: EncryptedString,
    userKey: UserKey,
    orgKeys: Record<OrganizationId, EncryptedOrganizationKeyData> | null,
  ) {
    await client.crypto().initialize_user_crypto({
      userId,
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
      privateKey,
      signingKey: undefined,
      securityState: undefined,
    });

    // We initialize the org crypto even if the org_keys are
    // null to make sure any existing org keys are cleared.
    await client.crypto().initialize_org_crypto({
      organizationKeys: new Map(
        Object.entries(orgKeys ?? {})
          .filter(([_, v]) => v.type === "organization")
          .map(([k, v]) => [k, v.key as UnsignedSharedKey]),
      ),
    });

    // Initialize the SDK managed database and the client managed repositories.
    await initializeState(userId, client.platform().state(), this.stateProvider);
  }

  private toSettings(env: Environment): ClientSettings {
    return {
      apiUrl: env.getApiUrl(),
      identityUrl: env.getIdentityUrl(),
      deviceType: this.toDevice(this.platformUtilsService.getDevice()),
      userAgent: this.userAgent ?? navigator.userAgent,
    };
  }

  private toDevice(device: DeviceType): SdkDeviceType {
    switch (device) {
      case DeviceType.Android:
        return "Android";
      case DeviceType.iOS:
        return "iOS";
      case DeviceType.ChromeExtension:
        return "ChromeExtension";
      case DeviceType.FirefoxExtension:
        return "FirefoxExtension";
      case DeviceType.OperaExtension:
        return "OperaExtension";
      case DeviceType.EdgeExtension:
        return "EdgeExtension";
      case DeviceType.WindowsDesktop:
        return "WindowsDesktop";
      case DeviceType.MacOsDesktop:
        return "MacOsDesktop";
      case DeviceType.LinuxDesktop:
        return "LinuxDesktop";
      case DeviceType.ChromeBrowser:
        return "ChromeBrowser";
      case DeviceType.FirefoxBrowser:
        return "FirefoxBrowser";
      case DeviceType.OperaBrowser:
        return "OperaBrowser";
      case DeviceType.EdgeBrowser:
        return "EdgeBrowser";
      case DeviceType.IEBrowser:
        return "IEBrowser";
      case DeviceType.UnknownBrowser:
        return "UnknownBrowser";
      case DeviceType.AndroidAmazon:
        return "AndroidAmazon";
      case DeviceType.UWP:
        return "UWP";
      case DeviceType.SafariBrowser:
        return "SafariBrowser";
      case DeviceType.VivaldiBrowser:
        return "VivaldiBrowser";
      case DeviceType.VivaldiExtension:
        return "VivaldiExtension";
      case DeviceType.SafariExtension:
        return "SafariExtension";
      case DeviceType.Server:
        return "Server";
      case DeviceType.WindowsCLI:
        return "WindowsCLI";
      case DeviceType.MacOsCLI:
        return "MacOsCLI";
      case DeviceType.LinuxCLI:
        return "LinuxCLI";
      default:
        return "SDK";
    }
  }
}
