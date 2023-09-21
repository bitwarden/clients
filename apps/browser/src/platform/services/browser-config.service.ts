import { ReplaySubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { ConfigApiServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config-api.service.abstraction";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ConfigService } from "@bitwarden/common/platform/services/config/config.service";

import { browserSession, sessionSync } from "../decorators/session-sync-observable";

@browserSession
export class BrowserConfigService extends ConfigService {
  @sessionSync<ServerConfig>({ initializer: ServerConfig.fromJSON })
  protected _serverConfig: ReplaySubject<ServerConfig | null>;

  constructor(
    stateService: StateService,
    configApiService: ConfigApiServiceAbstraction,
    authService: AuthService,
    environmentService: EnvironmentService,
    logService: LogService,
    subscribe = false
  ) {
    super(stateService, configApiService, authService, environmentService, logService, subscribe);
  }
}
