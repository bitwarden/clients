import { Observable } from "rxjs";

import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { GlobalState, GlobalStateProvider } from "@bitwarden/common/platform/state";

import { LoginStrategyCacheService } from "../../abstractions/login-strategy-cache.service";

import {
  CACHE_EXPIRATION_KEY,
  CACHE_KEY,
  CacheData,
  CURRENT_LOGIN_STRATEGY_KEY,
} from "./login-strategy.state";

export class DefaultLoginStrategyCacheService implements LoginStrategyCacheService {
  private currentAuthnTypeState: GlobalState<AuthenticationType | null>;
  private loginStrategyCacheState: GlobalState<CacheData | null>;
  private loginStrategyCacheExpirationState: GlobalState<Date | null>;

  currentAuthType$: Observable<AuthenticationType | null>;
  cacheData$: Observable<CacheData | null>;
  cacheExpiration$: Observable<Date | null>;

  constructor(private stateProvider: GlobalStateProvider) {
    this.currentAuthnTypeState = this.stateProvider.get(CURRENT_LOGIN_STRATEGY_KEY);
    this.loginStrategyCacheState = this.stateProvider.get(CACHE_KEY);
    this.loginStrategyCacheExpirationState = this.stateProvider.get(CACHE_EXPIRATION_KEY);

    this.currentAuthType$ = this.currentAuthnTypeState.state$;
    this.cacheData$ = this.loginStrategyCacheState.state$;
    this.cacheExpiration$ = this.loginStrategyCacheExpirationState.state$;
  }

  async setCurrentAuthType(type: AuthenticationType | null): Promise<void> {
    await this.currentAuthnTypeState.update((_) => type);
  }

  async setCacheData(data: CacheData | null): Promise<void> {
    await this.loginStrategyCacheState.update((_) => data);
  }

  async setCacheExpiration(date: Date | null): Promise<void> {
    await this.loginStrategyCacheExpirationState.update((_) => date);
  }

  async clearCache(): Promise<void> {
    await this.currentAuthnTypeState.update((_) => null);
    await this.loginStrategyCacheState.update((_) => null);
    await this.loginStrategyCacheExpirationState.update((_) => null);
  }
}
