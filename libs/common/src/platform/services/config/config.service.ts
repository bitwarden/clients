import { BehaviorSubject, concatMap, from, timer } from "rxjs";

import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigApiServiceAbstraction } from "../../abstractions/config/config-api.service.abstraction";
import { ConfigServiceAbstraction } from "../../abstractions/config/config.service.abstraction";
import { ServerConfig } from "../../abstractions/config/server-config";
import { EnvironmentService } from "../../abstractions/environment.service";
import { StateService } from "../../abstractions/state.service";
import { ServerConfigData } from "../../models/data/server-config.data";

export class ConfigService implements ConfigServiceAbstraction {
  protected _serverConfig = new BehaviorSubject<ServerConfig | null>(null);
  serverConfig$ = this._serverConfig.asObservable();

  constructor(
    private stateService: StateService,
    private configApiService: ConfigApiServiceAbstraction,
    private authService: AuthService,
    private environmentService: EnvironmentService
  ) {
    // Re-fetch the server config every hour
    timer(0, 1000 * 3600)
      .pipe(concatMap(() => from(this.fetchServerConfig())))
      .subscribe((serverConfig) => {
        this._serverConfig.next(serverConfig);
      });

    this.environmentService.urls.subscribe(() => {
      this.fetchServerConfig();
    });
  }

  async fetchServerConfig(): Promise<ServerConfig> {
    try {
      const response = await this.configApiService.get();

      if (response != null) {
        const data = new ServerConfigData(response);
        const serverConfig = new ServerConfig(data);
        this._serverConfig.next(serverConfig);
        if ((await this.authService.getAuthStatus()) === AuthenticationStatus.LoggedOut) {
          return serverConfig;
        }
        await this.stateService.setServerConfig(data);
        this.environmentService.setCloudWebVaultUrl(data.environment?.cloudRegion);
      }
    } catch {
      return null;
    }
  }

  async getFeatureFlagBool(key: FeatureFlag, defaultValue = false): Promise<boolean> {
    return await this.getFeatureFlag(key, defaultValue);
  }

  async getFeatureFlagString(key: FeatureFlag, defaultValue = ""): Promise<string> {
    return await this.getFeatureFlag(key, defaultValue);
  }

  async getFeatureFlagNumber(key: FeatureFlag, defaultValue = 0): Promise<number> {
    return await this.getFeatureFlag(key, defaultValue);
  }

  async getCloudRegion(defaultValue = "US"): Promise<string> {
    const serverConfig = await this.buildServerConfig();
    return serverConfig.environment?.cloudRegion ?? defaultValue;
  }

  private async getFeatureFlag<T>(key: FeatureFlag, defaultValue: T): Promise<T> {
    const serverConfig = await this.buildServerConfig();
    if (
      serverConfig == null ||
      serverConfig.featureStates == null ||
      serverConfig.featureStates[key] == null
    ) {
      return defaultValue;
    }
    return serverConfig.featureStates[key] as T;
  }

  private async buildServerConfig(): Promise<ServerConfig> {
    const data = await this.stateService.getServerConfig();
    const domain = data ? new ServerConfig(data) : this._serverConfig.getValue();

    if (domain == null || !domain.isValid() || domain.expiresSoon()) {
      const value = await this.fetchServerConfig();
      return value ?? domain;
    }

    return domain;
  }
}
