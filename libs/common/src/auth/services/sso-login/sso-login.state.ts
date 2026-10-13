import { KeyDefinition, SSO_DISK, SSO_DISK_LOCAL, UserKeyDefinition } from "@bitwarden/state";

import { SsoRequiredCacheEntry } from "../../abstractions/sso-login.service.abstraction";

/**
 * Uses disk storage so that the code verifier can be persisted across sso redirects.
 */
export const CODE_VERIFIER = new KeyDefinition<string>(SSO_DISK, "ssoCodeVerifier", {
  deserializer: (codeVerifier) => codeVerifier,
});

/**
 * Uses disk storage so that the sso state can be persisted across sso redirects.
 */
export const SSO_STATE = new KeyDefinition<string>(SSO_DISK, "ssoState", {
  deserializer: (state) => state,
});

/**
 * Uses disk storage so that the organization sso identifier can be persisted across sso redirects.
 */
export const USER_ORGANIZATION_SSO_IDENTIFIER = new UserKeyDefinition<string>(
  SSO_DISK,
  "organizationSsoIdentifier",
  {
    deserializer: (organizationIdentifier) => organizationIdentifier,
    clearOn: ["logout"], // Used for login, so not needed past logout
  },
);

/**
 * Uses disk storage so that the organization sso identifier can be persisted across sso redirects.
 */
export const GLOBAL_ORGANIZATION_SSO_IDENTIFIER = new KeyDefinition<string>(
  SSO_DISK,
  "organizationSsoIdentifier",
  {
    deserializer: (organizationIdentifier) => organizationIdentifier,
  },
);

/**
 * Uses disk storage so that the user's email can be persisted across sso redirects.
 */
export const SSO_EMAIL = new KeyDefinition<string>(SSO_DISK, "ssoEmail", {
  deserializer: (state) => state,
});

/**
 * A cache list of users for whom the `PolicyType.RequireSso` policy is applied (that is, a list
 * of users who are required to authenticate via SSO only). The cache lives on the current device only.
 */
export const SSO_REQUIRED_CACHE = new KeyDefinition<SsoRequiredCacheEntry[]>(
  SSO_DISK_LOCAL,
  "ssoRequiredCache",
  {
    deserializer: (cache) => {
      // TODO: Remove deserializer check - https://bitwarden.atlassian.net/browse/PM-35145
      if (cache == null || cache.length === 0) {
        return cache;
      }

      // Old cache format was just an array of emails (string[]). Clear it since we cannot use
      // that format to infer the environment. New cache format uses SsoRequiredCacheEntry[].
      // User will naturally populate the new cache format upon next SSO-required login.
      if (typeof cache[0] === "string") {
        return null;
      }

      return cache;
    },
  },
);
