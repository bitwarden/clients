import {
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  map,
  mergeWith,
  NEVER,
  Observable,
  of,
  ReplaySubject,
  share,
  Subject,
  switchMap,
  tap,
  timer,
} from "rxjs";
import { SemVer } from "semver";

import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import {
  AllowedFeatureFlagTypes,
  FeatureFlag,
  getFeatureFlagValue,
} from "../../../enums/feature-flag.enum";
import { UserId } from "../../../types/guid";
import { ConfigApiServiceAbstraction } from "../../abstractions/config/config-api.service.abstraction";
import { ConfigService } from "../../abstractions/config/config.service";
import { ServerConfig } from "../../abstractions/config/server-config";
import { Environment, EnvironmentService, Region } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { devFlagEnabled, devFlagValue } from "../../misc/flags";
import { ServerConfigData } from "../../models/data/server-config.data";
import { ServerSettings } from "../../models/domain/server-settings";
import { ServerConfigResponse } from "../../models/response/server-config.response";
import { CONFIG_DISK, KeyDefinition, StateProvider, UserKeyDefinition } from "../../state";

export const RETRIEVAL_INTERVAL = devFlagEnabled("configRetrievalIntervalMs")
  ? (devFlagValue("configRetrievalIntervalMs") as number)
  : 3_600_000; // 1 hour

export const SLOW_EMISSION_GUARD = 800;

export type ApiUrl = string;

export const USER_SERVER_CONFIG = new UserKeyDefinition<ServerConfig>(CONFIG_DISK, "serverConfig", {
  deserializer: (data) => (data == null ? null : ServerConfig.fromJSON(data)),
  clearOn: ["logout"],
});

export const GLOBAL_SERVER_CONFIGURATIONS = KeyDefinition.record<ServerConfig, ApiUrl>(
  CONFIG_DISK,
  "byServer",
  {
    deserializer: (data) => (data == null ? null : ServerConfig.fromJSON(data)),
  },
);

const environmentComparer = (previous: Environment, current: Environment) => {
  return previous.getApiUrl() === current.getApiUrl();
};

// FIXME: currently we are limited to api requests for active users. Update to accept a UserId and APIUrl once ApiService supports it.
export class DefaultConfigService implements ConfigService {
  private failedFetchFallbackSubject = new Subject<ServerConfig | null>();

  serverConfig$: Observable<ServerConfig | null>;

  featureStates$: Observable<{ [key: string]: AllowedFeatureFlagTypes } | undefined>;

  serverSettings$: Observable<ServerSettings>;

  cloudRegion$: Observable<Region>;

  constructor(
    private configApiService: ConfigApiServiceAbstraction,
    private environmentService: EnvironmentService,
    private logService: LogService,
    private stateProvider: StateProvider,
    private authService: AuthService,
  ) {
    const globalConfig$ = this.environmentService.globalEnvironment$.pipe(
      distinctUntilChanged(environmentComparer),
      switchMap((environment) =>
        this.globalConfigFor$(environment.getApiUrl()).pipe(
          map((config) => {
            return [config, null as UserId | null, environment, config] as const;
          }),
        ),
      ),
    );

    this.serverConfig$ = this.stateProvider.activeUserId$.pipe(
      distinctUntilChanged(),
      switchMap((userId) => {
        if (userId == null) {
          // Global
          return globalConfig$;
        }

        return this.authService.authStatusFor$(userId).pipe(
          map((authStatus) => authStatus === AuthenticationStatus.Unlocked),
          distinctUntilChanged(),
          switchMap((isUnlocked) => {
            if (!isUnlocked) {
              return globalConfig$;
            }

            return combineLatest([
              this.environmentService
                .getEnvironment$(userId)
                .pipe(distinctUntilChanged(environmentComparer)),
              this.userConfigFor$(userId),
            ]).pipe(
              switchMap(([environment, config]) => {
                if (config == null) {
                  // If the user doesn't have any config yet, use the global config for that url as the fallback
                  return this.globalConfigFor$(environment.getApiUrl()).pipe(
                    map(
                      (globalConfig) =>
                        [null as ServerConfig | null, userId, environment, globalConfig] as const,
                    ),
                  );
                }

                return of([config, userId, environment, config] as const);
              }),
            );
          }),
        );
      }),
      tap(async (rec) => {
        const [existingConfig, userId, environment, fallbackConfig] = rec;
        // Grab new config if older retrieval interval
        if (!existingConfig || this.olderThanRetrievalInterval(existingConfig.utcDate)) {
          await this.renewConfig(existingConfig, userId, environment, fallbackConfig);
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
      share({ connector: () => new ReplaySubject(1), resetOnRefCountZero: () => timer(1000) }),
    );

    this.cloudRegion$ = this.serverConfig$.pipe(
      map((config) => config?.environment?.cloudRegion ?? Region.US),
    );

    this.serverSettings$ = this.serverConfig$.pipe(
      map((config) => config?.settings ?? new ServerSettings()),
    );

    this.featureStates$ = this.serverConfig$.pipe(
      map((config) => config?.featureStates ?? undefined),
    );
  }

  async refreshServerConfig() {
    const activeUserId = (await firstValueFrom(this.stateProvider.activeUserId$)) ?? null;

    const serverConfigResponse = await this.configApiService.get(activeUserId);

    let environment: Environment | null = null;

    if (activeUserId == null) {
      // Pull env from global if no active user
      environment = await firstValueFrom(this.environmentService.globalEnvironment$);
    }

    await this.handleServerConfigResponse(activeUserId, serverConfigResponse, null, environment);
  }

  getFeatureFlag$<Flag extends FeatureFlag>(key: Flag) {
    return this.serverConfig$.pipe(map((serverConfig) => getFeatureFlagValue(serverConfig, key)));
  }

  userCachedFeatureFlag$<Flag extends FeatureFlag>(key: Flag, userId: UserId) {
    return this.stateProvider
      .getUser(userId, USER_SERVER_CONFIG)
      .state$.pipe(map((config) => getFeatureFlagValue(config, key)));
  }

  async getFeatureFlag<Flag extends FeatureFlag>(key: Flag) {
    return await firstValueFrom(this.getFeatureFlag$(key));
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
    existingConfig: ServerConfig | null,
    userId: UserId | null,
    environment: Environment,
    fallbackConfig: ServerConfig | null,
  ): Promise<void> {
    try {
      // Feature flags often have a big impact on user experience, lets ensure we return some value
      // somewhat quickly even though it may not be accurate, we won't cancel the HTTP request
      // though so that hopefully it can have finished and hydrated a more accurate value.
      const handle = setTimeout(() => {
        this.logService.info("Environment did not respond in time, emitting previous config.");
        this.failedFetchFallbackSubject.next(fallbackConfig);
      }, SLOW_EMISSION_GUARD);
      const response = await this.configApiService.get(userId);
      clearTimeout(handle);
      await this.handleServerConfigResponse(userId, response, existingConfig, environment);
    } catch (e) {
      // mutate error to be handled by catchError
      this.logService.error(`Unable to fetch ServerConfig from ${environment.getApiUrl()}`, e);
      // Emit the existing config
      this.failedFetchFallbackSubject.next(fallbackConfig);
    }
  }

  private async handleServerConfigResponse(
    userId: UserId | null,
    serverConfigResponse: ServerConfigResponse,
    existingConfig: ServerConfig | null,
    environment: Environment | null,
  ) {
    const newConfig = new ServerConfig(new ServerConfigData(serverConfigResponse));

    // Update the environment region
    if (
      newConfig?.environment?.cloudRegion != null &&
      existingConfig?.environment?.cloudRegion != newConfig.environment.cloudRegion
    ) {
      // Null userId sets global, otherwise sets to the given user
      await this.environmentService.setCloudRegion(userId, newConfig?.environment?.cloudRegion);
    }

    if (userId == null) {
      if (environment == null) {
        throw new Error("Environment is required when updating global config without a userId");
      }

      // update global state with new pulled config
      await this.stateProvider.getGlobal(GLOBAL_SERVER_CONFIGURATIONS).update((configs) => {
        return { ...configs, [environment.getApiUrl()]: newConfig };
      });
    } else {
      // update state with new pulled config
      await this.stateProvider.setUserState(USER_SERVER_CONFIG, newConfig, userId);
    }
  }

  private globalConfigFor$(apiUrl: string): Observable<ServerConfig | null> {
    return this.stateProvider
      .getGlobal(GLOBAL_SERVER_CONFIGURATIONS)
      .state$.pipe(map((configs) => configs?.[apiUrl] ?? null));
  }

  private userConfigFor$(userId: UserId): Observable<ServerConfig | null> {
    return this.stateProvider.getUser(userId, USER_SERVER_CONFIG).state$;
  }
}
