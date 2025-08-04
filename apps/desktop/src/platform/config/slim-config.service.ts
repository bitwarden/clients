import { combineLatest, map, Observable, throwError } from "rxjs";
import { SemVer } from "semver";

import {
  FeatureFlag,
  FeatureFlagValueType,
  getFeatureFlagValue,
} from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { ServerSettings } from "@bitwarden/common/platform/models/domain/server-settings";
import { GLOBAL_SERVER_CONFIGURATIONS } from "@bitwarden/common/platform/services/config/default-config.service";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/user-core";

/*
    NOT FOR GENERAL USE

    If you have more uses for the config service in the main process,
    please reach out to platform.
*/
export class SlimConfigService implements ConfigService {
  constructor(
    private environmentService: EnvironmentService,
    private globalStateProvider: GlobalStateProvider,
  ) {}

  serverConfig$: Observable<ServerConfig> = throwError(() => {
    return new Error("Method not implemented.");
  });
  serverSettings$: Observable<ServerSettings> = throwError(() => {
    return new Error("Method not implemented.");
  });
  cloudRegion$: Observable<Region> = throwError(() => {
    return new Error("Method not implemented.");
  });
  getFeatureFlag$<Flag extends FeatureFlag>(key: Flag): Observable<FeatureFlagValueType<Flag>> {
    return combineLatest([
      this.environmentService.environment$,
      this.globalStateProvider.get(GLOBAL_SERVER_CONFIGURATIONS).state$,
    ]).pipe(
      map(([environment, serverConfigMap]) =>
        getFeatureFlagValue(serverConfigMap?.[environment.getApiUrl()], key),
      ),
    );
  }
  userCachedFeatureFlag$<Flag extends FeatureFlag>(
    key: Flag,
    userId: UserId,
  ): Observable<FeatureFlagValueType<Flag>> {
    throw new Error("Method not implemented.");
  }
  getFeatureFlag<Flag extends FeatureFlag>(key: Flag): Promise<FeatureFlagValueType<Flag>> {
    throw new Error("Method not implemented.");
  }
  checkServerMeetsVersionRequirement$(minimumRequiredServerVersion: SemVer): Observable<boolean> {
    throw new Error("Method not implemented.");
  }
  ensureConfigFetched(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
