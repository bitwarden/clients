// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
} from "rxjs";

import { KeyService, KdfConfigService, KdfConfig, KdfType } from "@bitwarden/key-management";
import {
  BitwardenClient,
  ClientSettings,
  LogLevel,
  DeviceType as SdkDeviceType,
} from "@bitwarden/sdk-internal";

import { EncryptedOrganizationKeyData } from "../../../admin-console/models/data/encrypted-organization-key.data";
import { AccountInfo, AccountService } from "../../../auth/abstractions/account.service";
import { DeviceType } from "../../../enums/device-type.enum";
import { OrganizationId, UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";
import { SdkService } from "../../abstractions/sdk/sdk.service";
import { compareValues } from "../../misc/compare-values";
import { Rc } from "../../misc/reference-counting/rc";
import { EncryptedString } from "../../models/domain/enc-string";

export class DefaultSdkService implements SdkService {
  private sdkClientCache = new Map<UserId, Observable<Rc<BitwardenClient>>>();

  client$ = this.environmentService.environment$.pipe(
    concatMap(async (env) => {
      const settings = this.toSettings(env);
      return await this.sdkClientFactory.createSdkClient(settings, LogLevel.Info);
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
    private userAgent: string = null,
  ) {}

  userClient$(userId: UserId): Observable<Rc<BitwardenClient> | undefined> {
    // TODO: Figure out what happens when the user logs out
    if (this.sdkClientCache.has(userId)) {
      return this.sdkClientCache.get(userId);
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
    ]).pipe(
      // switchMap is required to allow the clean-up logic to be executed when `combineLatest` emits a new value.
      switchMap(([env, account, kdfParams, privateKey, userKey, orgKeys]) => {
        // Create our own observable to be able to implement clean-up logic
        return new Observable<Rc<BitwardenClient>>((subscriber) => {
          const createAndInitializeClient = async () => {
            if (privateKey == null || userKey == null) {
              return undefined;
            }

            const settings = this.toSettings(env);
            const client = await this.sdkClientFactory.createSdkClient(settings, LogLevel.Info);

            await this.initializeClient(client, account, kdfParams, privateKey, userKey, orgKeys);

            return client;
          };

          let client: Rc<BitwardenClient>;
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
      tap({
        finalize: () => this.sdkClientCache.delete(userId),
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.sdkClientCache.set(userId, client$);
    return client$;
  }

  private async initializeClient(
    client: BitwardenClient,
    account: AccountInfo,
    kdfParams: KdfConfig,
    privateKey: EncryptedString,
    userKey: UserKey,
    orgKeys?: Record<OrganizationId, EncryptedOrganizationKeyData>,
  ) {
    await client.crypto().initialize_user_crypto({
      email: account.email,
      method: { decryptedKey: { decrypted_user_key: userKey.keyB64 } },
      kdfParams:
        kdfParams.kdfType === KdfType.PBKDF2_SHA256
          ? {
              pBKDF2: { iterations: kdfParams.iterations },
            }
          : {
              argon2id: {
                iterations: kdfParams.iterations,
                memory: kdfParams.memory,
                parallelism: kdfParams.parallelism,
              },
            },
      privateKey,
    });

    // We initialize the org crypto even if the org_keys are
    // null to make sure any existing org keys are cleared.
    await client.crypto().initialize_org_crypto({
      organizationKeys: new Map(
        Object.entries(orgKeys ?? {})
          .filter(([_, v]) => v.type === "organization")
          .map(([k, v]) => [k, v.key]),
      ),
    });
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
