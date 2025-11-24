import {
  combineLatest,
  concatMap,
  Observable,
  shareReplay,
  map,
  distinctUntilChanged,
  tap,
  switchMap,
  BehaviorSubject,
  of,
  takeWhile,
  throwIfEmpty,
  firstValueFrom,
} from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BitwardenClient, ClientSettings, TokenProvider } from "@bitwarden/sdk-internal";

import { ApiService } from "../../../abstractions/api.service";
import { AccountService } from "../../../auth/abstractions/account.service";
import { UserId } from "../../../types/guid";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { RegisterSdkService } from "../../abstractions/sdk/register-sdk.service";
import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import { toSdkDevice, UserNotLoggedInError } from "../../abstractions/sdk/sdk.service";
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

export class DefaultRegisterSdkService implements RegisterSdkService {
  private sdkClientOverrides = new BehaviorSubject<{
    [userId: UserId]: Rc<BitwardenClient> | typeof UnsetClient;
  }>({});
  private sdkClientCache = new Map<UserId, Observable<Rc<BitwardenClient>>>();

  client$ = this.environmentService.environment$.pipe(
    concatMap(async (env) => {
      await SdkLoadService.Ready;
      const settings = this.toSettings(env);
      const client = await this.sdkClientFactory.createSdkClient(
        new JsTokenProvider(this.apiService),
        settings,
      );
      await this.loadFeatureFlags(client);
      return client;
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  constructor(
    private sdkClientFactory: SdkClientFactory,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private accountService: AccountService,
    private apiService: ApiService,
    private stateProvider: StateProvider,
    private configService: ConfigService,
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

  /**
   * This method is used to create a client for a specific user by using the existing state of the application.
   * This client is token-only and does not initialize any encryption keys.
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

    const client$ = combineLatest([
      this.environmentService.getEnvironment$(userId),
      account$,
      SdkLoadService.Ready, // Makes sure we wait (once) for the SDK to be loaded
    ]).pipe(
      // switchMap is required to allow the clean-up logic to be executed when `combineLatest` emits a new value.
      switchMap(([env, account]) => {
        // Create our own observable to be able to implement clean-up logic
        return new Observable<Rc<BitwardenClient>>((subscriber) => {
          const createAndInitializeClient = async () => {
            if (env == null || account == null) {
              return undefined;
            }

            const settings = this.toSettings(env);
            const client = await this.sdkClientFactory.createSdkClient(
              new JsTokenProvider(this.apiService, userId),
              settings,
            );

            // Initialize the SDK managed database and the client managed repositories.
            await initializeState(userId, client.platform().state(), this.stateProvider);

            await this.loadFeatureFlags(client);

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

  private async loadFeatureFlags(client: BitwardenClient) {
    const serverConfig = await firstValueFrom(this.configService.serverConfig$);

    const featureFlagMap = new Map(
      Object.entries(serverConfig?.featureStates ?? {})
        .filter(([, value]) => typeof value === "boolean") // The SDK only supports boolean feature flags at this time
        .map(([key, value]) => [key, value] as [string, boolean]),
    );

    client.platform().load_flags(featureFlagMap);
  }

  private toSettings(env: Environment): ClientSettings {
    return {
      apiUrl: env.getApiUrl(),
      identityUrl: env.getIdentityUrl(),
      deviceType: toSdkDevice(this.platformUtilsService.getDevice()),
      userAgent: this.userAgent ?? navigator.userAgent,
    };
  }
}
