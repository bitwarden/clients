// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { KeyDefinition, LOGIN_STRATEGY_MEMORY } from "@bitwarden/common/platform/state";

import { AuthRequestLoginStrategyData } from "../../login-strategies/auth-request-login.strategy";
import { PasswordLoginStrategyData } from "../../login-strategies/password-login.strategy";
import { SsoLoginStrategyData } from "../../login-strategies/sso-login.strategy";
import { UserApiLoginStrategyData } from "../../login-strategies/user-api-login.strategy";
import { WebAuthnLoginStrategyData } from "../../login-strategies/webauthn-login.strategy";

/**
 * The current login strategy in use.
 */
export const CURRENT_LOGIN_STRATEGY_KEY = new KeyDefinition<AuthenticationType | null>(
  LOGIN_STRATEGY_MEMORY,
  "currentLoginStrategy",
  {
    deserializer: (data) => data,
  },
);

/**
 * The expiration date for the login strategy cache.
 * Used as a backup to the timer set on the service.
 */
export const CACHE_EXPIRATION_KEY = new KeyDefinition<Date | null>(
  LOGIN_STRATEGY_MEMORY,
  "loginStrategyCacheExpiration",
  {
    deserializer: (data) => (data ? null : new Date(data)),
  },
);

/**
 * Auth Request notification for all instances of the login strategy service.
 * Note: this isn't an ideal approach, but allows both a background and
 * foreground instance to send out the notification.
 * TODO: Move to Auth Request service.
 */
export const AUTH_REQUEST_PUSH_NOTIFICATION_KEY = new KeyDefinition<string | null>(
  LOGIN_STRATEGY_MEMORY,
  "authRequestPushNotification",
  {
    deserializer: (data) => data,
  },
);

export type CacheData = {
  password?: PasswordLoginStrategyData;
  sso?: SsoLoginStrategyData;
  userApiKey?: UserApiLoginStrategyData;
  authRequest?: AuthRequestLoginStrategyData;
  webAuthn?: WebAuthnLoginStrategyData;
};

/**
 * A cache for login strategies to use for data persistence through
 * the login process.
 */
export const CACHE_KEY = new KeyDefinition<CacheData | null>(
  LOGIN_STRATEGY_MEMORY,
  "loginStrategyCache",
  {
    deserializer: (data) => {
      if (data == null) {
        return null;
      }
      return {
        password: data.password ? PasswordLoginStrategyData.fromJSON(data.password) : undefined,
        sso: data.sso ? SsoLoginStrategyData.fromJSON(data.sso) : undefined,
        userApiKey: data.userApiKey
          ? UserApiLoginStrategyData.fromJSON(data.userApiKey)
          : undefined,
        authRequest: data.authRequest
          ? AuthRequestLoginStrategyData.fromJSON(data.authRequest)
          : undefined,
        webAuthn: data.webAuthn ? WebAuthnLoginStrategyData.fromJSON(data.webAuthn) : undefined,
      };
    },
  },
);
