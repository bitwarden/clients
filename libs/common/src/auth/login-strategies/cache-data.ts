import { AuthRequestLoginStrategyData } from "./auth-request-login.strategy";
import { PasswordLoginStrategyData } from "./password-login.strategy";
import { SsoLoginStrategyData } from "./sso-login.strategy";
import { UserApiLoginStrategyData } from "./user-api-login.strategy";
import { WebAuthnLoginStrategyData } from "./webauthn-login.strategy";

export type CacheData = {
  password?: PasswordLoginStrategyData;
  sso?: SsoLoginStrategyData;
  userApiKey?: UserApiLoginStrategyData;
  authRequest?: AuthRequestLoginStrategyData;
  webAuthn?: WebAuthnLoginStrategyData;
};
