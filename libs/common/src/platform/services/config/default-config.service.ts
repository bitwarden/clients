import {
  NEVER,
  Observable,
  Subject,
  combineLatest,
  firstValueFrom,
  map,
  mergeWith,
  of,
  shareReplay,
  switchMap,
  tap,
} from "rxjs";
import { SemVer } from "semver";

import { FeatureFlag, FeatureFlagValue } from "../../../enums/feature-flag.enum";
import { UserId } from "../../../types/guid";
import { ConfigApiServiceAbstraction } from "../../abstractions/config/config-api.service.abstraction";
import { ConfigService } from "../../abstractions/config/config.service";
import { ServerConfig } from "../../abstractions/config/server-config";
import { EnvironmentService, Region } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { ServerConfigData } from "../../models/data/server-config.data";
import { CONFIG_DISK, KeyDefinition, StateProvider, UserKeyDefinition } from "../../state";

export const RETRIEVAL_INTERVAL = 3_600_000; // 1 hour

export type ApiUrl = string;

export const USER_SERVER_CONFIG = new UserKeyDefinition<ServerConfig>(CONFIG_DISK, "serverConfig", {
  deserializer: (data) => (data == null ? null : ServerConfig.fromJSON(data)),
  clearOn: ["logout"],
});

// TODO MDG: When to clean these up?
export const GLOBAL_SERVER_CONFIGURATIONS = KeyDefinition.record<ServerConfig, ApiUrl>(
  CONFIG_DISK,
  "byServer",
  {
    deserializer: (data) => (data == null ? null : ServerConfig.fromJSON(data)),
  },
);

// FIXME: currently we are limited to api requests for active users. Update to accept a UserId and APIUrl once ApiService supports it.
export class DefaultConfigService implements ConfigService {
  private failedFetchFallbackSubject = new Subject<ServerConfig>();

  serverConfig$: Observable<ServerConfig>;

  cloudRegion$: Observable<Region>;

  constructor(
    private configApiService: ConfigApiServiceAbstraction,
    private environmentService: EnvironmentService,
    private logService: LogService,
    private stateProvider: StateProvider,
  ) {
    const apiUrl$ = this.environmentService.environment$.pipe(
      map((environment) => environment.getApiUrl()),
    );

    this.serverConfig$ = combineLatest([this.stateProvider.activeUserId$, apiUrl$]).pipe(
      switchMap(([userId, apiUrl]) => {
        const config$ =
          userId == null ? this.globalConfigFor$(apiUrl) : this.userConfigFor$(userId);
        return config$.pipe(map((config) => [config, userId, apiUrl] as const));
      }),
      tap(async (rec) => {
        const [existingConfig, userId, apiUrl] = rec;
        // Grab new config if older retrieval interval
        if (!existingConfig || this.olderThanRetrievalInterval(existingConfig.utcDate)) {
          await this.renewConfig(existingConfig, userId, apiUrl);
        }
      }),
      switchMap(([existingConfig]) => {
        // If we needed to fetch, stop this emit, we'll get a new one after update
        // This is split up with the above tap because we need to return an observable from a failed promise,
        // which isn't very doable since promises are converted to observables in switchMap
        if (!existingConfig || this.olderThanRetrievalInterval(existingConfig.utcDate)) {
          return NEVER;
        }
        return of(existingConfig);
      }),
      // If fetch fails, we'll emit on this subject to fallback to the existing config
      mergeWith(this.failedFetchFallbackSubject),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.cloudRegion$ = this.serverConfig$.pipe(
      map((config) => config?.environment?.cloudRegion ?? Region.US),
    );
  }
  getFeatureFlag$<T extends FeatureFlagValue>(key: FeatureFlag, defaultValue?: T) {
    return this.serverConfig$.pipe(
      map((serverConfig) => {
        if (serverConfig?.featureStates == null || serverConfig.featureStates[key] == null) {
          return defaultValue;
        }

        return serverConfig.featureStates[key] as T;
      }),
    );
  }

  async getFeatureFlag<T extends FeatureFlagValue>(key: FeatureFlag, defaultValue?: T) {
    return await firstValueFrom(this.getFeatureFlag$(key, defaultValue));
  }

  checkServerMeetsVersionRequirement$(minimumRequiredServerVersion: SemVer) {
    return this.serverConfig$.pipe(
      map((serverConfig) => {
        if (serverConfig == null) {
          return false;
        }
        const serverVersion = new SemVer(serverConfig.version);
        return serverVersion.compare(minimumRequiredServerVersion) >= 0;
      }),
    );
  }

  async ensureConfigFetched() {
    // Triggering a retrieval for the given user ensures that the config is less than RETRIEVAL_INTERVAL old
    await firstValueFrom(this.serverConfig$);
  }

  private olderThanRetrievalInterval(date: Date) {
    return new Date().getTime() - date.getTime() > RETRIEVAL_INTERVAL;
  }

  // Updates the on-disk configuration with a newly retrieved configuration
  private async renewConfig(
    existingConfig: ServerConfig,
    userId: UserId,
    apiUrl: string,
  ): Promise<void> {
    try {
      const response = await this.configApiService.get(userId);
      const newConfig = new ServerConfig(new ServerConfigData(response));

      // Update the environment region
      if (
        newConfig?.environment?.cloudRegion != null &&
        existingConfig?.environment?.cloudRegion != newConfig.environment.cloudRegion
      ) {
        // Null userId sets global, otherwise sets to the given user
        await this.environmentService.setCloudRegion(userId, newConfig?.environment?.cloudRegion);
      }

      if (userId == null) {
        // update global state with new pulled config
        await this.stateProvider.getGlobal(GLOBAL_SERVER_CONFIGURATIONS).update((configs) => {
          return { ...configs, [apiUrl]: newConfig };
        });
      } else {
        // update state with new pulled config
        await this.stateProvider.setUserState(USER_SERVER_CONFIG, newConfig, userId);
      }
    } catch (e) {
      // mutate error to be handled by catchError
      this.logService.error(
        `Unable to fetch ServerConfig from ${apiUrl}: ${(e as Error)?.message}`,
      );
      // Emit the existing config
      this.failedFetchFallbackSubject.next(existingConfig);
    }
  }

  private globalConfigFor$(apiUrl: string): Observable<ServerConfig> {
    return this.stateProvider
      .getGlobal(GLOBAL_SERVER_CONFIGURATIONS)
      .state$.pipe(map((configs) => configs?.[apiUrl]));
  }

  private userConfigFor$(userId: UserId): Observable<ServerConfig> {
    return this.stateProvider.getUser(userId, USER_SERVER_CONFIG).state$;
  }
}
