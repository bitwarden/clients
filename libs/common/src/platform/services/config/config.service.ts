import {
  ReplaySubject,
  Subject,
  catchError,
  concatMap,
  defer,
  delayWhen,
  firstValueFrom,
  map,
  merge,
  timer,
} from "rxjs";

import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { FeatureFlag, FeatureFlagValue } from "../../../enums/feature-flag.enum";
import { ConfigApiServiceAbstraction } from "../../abstractions/config/config-api.service.abstraction";
import { ConfigServiceAbstraction } from "../../abstractions/config/config.service.abstraction";
import { ServerConfig } from "../../abstractions/config/server-config";
import { EnvironmentService, Region } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { StateService } from "../../abstractions/state.service";
import { ServerConfigData } from "../../models/data/server-config.data";

const ONE_HOUR_IN_MILLISECONDS = 1000 * 3600;

export class ConfigService implements ConfigServiceAbstraction {
  protected _serverConfig = new ReplaySubject<ServerConfig | null>(1);
  serverConfig$ = this._serverConfig.asObservable();
  private _forceFetchConfig = new Subject<void>();
  private inited = false;

  cloudRegion$ = this.serverConfig$.pipe(
    map((config) => config?.environment?.cloudRegion ?? Region.US)
  );

  constructor(
    private stateService: StateService,
    private configApiService: ConfigApiServiceAbstraction,
    private authService: AuthService,
    private environmentService: EnvironmentService,
    private logService: LogService,

    // Used to avoid duplicate subscriptions, e.g. in browser between the background and popup
    private subscribe = true
  ) {}

  init() {
    if (!this.subscribe || this.inited) {
      return;
    }

    const latestServerConfig$ = defer(() => this.configApiService.get()).pipe(
      map((response) => new ServerConfigData(response)),
      delayWhen((data) => this.saveConfig(data)),
      catchError((e: unknown) => {
        // fall back to stored ServerConfig (if any)
        this.logService.error("Unable to fetch ServerConfig: " + (e as Error)?.message);
        return this.stateService.getServerConfig();
      })
    );

    // If you need to fetch a new config when an event occurs, add an observable that emits on that event here
    merge(
      timer(ONE_HOUR_IN_MILLISECONDS, ONE_HOUR_IN_MILLISECONDS), // after 1 hour, then every hour
      this.environmentService.urls, // when environment URLs change (including when app is started)
      this._forceFetchConfig // manual
    )
      .pipe(
        concatMap(() => latestServerConfig$),
        map((data) => (data == null ? null : new ServerConfig(data)))
      )
      .subscribe((config) => this._serverConfig.next(config));

    this.inited = true;
  }

  getFeatureFlag$<T extends FeatureFlagValue>(key: FeatureFlag, defaultValue?: T) {
    return this.serverConfig$.pipe(
      map((serverConfig) => {
        if (serverConfig?.featureStates == null || serverConfig.featureStates[key] == null) {
          return defaultValue;
        }

        return serverConfig.featureStates[key] as T;
      })
    );
  }

  async getFeatureFlag<T extends FeatureFlagValue>(key: FeatureFlag, defaultValue?: T) {
    return await firstValueFrom(this.getFeatureFlag$(key, defaultValue));
  }

  triggerServerConfigFetch() {
    this._forceFetchConfig.next();
  }

  private async saveConfig(data: ServerConfigData) {
    if ((await this.authService.getAuthStatus()) === AuthenticationStatus.LoggedOut) {
      return;
    }

    await this.stateService.setServerConfig(data);
    this.environmentService.setCloudWebVaultUrl(data.environment?.cloudRegion);
  }
}
