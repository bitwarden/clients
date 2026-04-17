import { Observable } from "rxjs";

import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";

import { CacheData } from "../services/login-strategies/login-strategy.state";

export abstract class LoginStrategyCacheService {
  abstract currentAuthType$: Observable<AuthenticationType | null>;
  abstract cacheData$: Observable<CacheData | null>;
  abstract cacheExpiration$: Observable<Date | null>;

  abstract setCurrentAuthType(type: AuthenticationType | null): Promise<void>;
  abstract setCacheData(data: CacheData | null): Promise<void>;
  abstract setCacheExpiration(date: Date | null): Promise<void>;
  /** Clears all three state keys to null. */
  abstract clearCache(): Promise<void>;
}
