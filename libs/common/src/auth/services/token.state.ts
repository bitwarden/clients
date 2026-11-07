import {
  KeyDefinition,
  TOKEN_DISK,
  TOKEN_DISK_LOCAL,
  TOKEN_MEMORY,
  UserKeyDefinition,
} from "../../platform/state";

// Note: all tokens / API key information must be cleared on logout.
// because we are using secure storage, we must manually call to clean up our tokens.
// See stateService.deAuthenticateAccount for where we call clearTokens(...)
// The access token has three possible locations: disk, memory, and the memory cache
// (see ACCESS_TOKEN_MEMORY_CACHE). All of them are cleared by hand.

export const ACCESS_TOKEN_DISK = new UserKeyDefinition<string>(TOKEN_DISK, "accessToken", {
  deserializer: (accessToken) => accessToken,
  clearOn: [], // Manually handled
});

export const ACCESS_TOKEN_MEMORY = new UserKeyDefinition<string>(TOKEN_MEMORY, "accessToken", {
  deserializer: (accessToken) => accessToken,
  clearOn: [], // Manually handled
});

/**
 * An ephemeral, plaintext copy of the access token, held only when the durable location is secure
 * storage. The durable copy stays authoritative; this cache exists to avoid a secure storage read
 * plus a decrypt on every request. It is lost on process reload and on app quit, at which point the
 * durable copy restores it. It is mutually exclusive with {@link ACCESS_TOKEN_MEMORY}, which means
 * "the durable location is memory".
 */
export const ACCESS_TOKEN_MEMORY_CACHE = new UserKeyDefinition<string>(
  TOKEN_MEMORY,
  "accessTokenCache",
  {
    deserializer: (accessToken) => accessToken,
    clearOn: [], // Manually handled; the cache survives lock.
  },
);

export const REFRESH_TOKEN_DISK = new UserKeyDefinition<string>(TOKEN_DISK, "refreshToken", {
  deserializer: (refreshToken) => refreshToken,
  clearOn: [], // Manually handled
});

export const REFRESH_TOKEN_MEMORY = new UserKeyDefinition<string>(TOKEN_MEMORY, "refreshToken", {
  deserializer: (refreshToken) => refreshToken,
  clearOn: [], // Manually handled
});

export const EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL = KeyDefinition.record<string, string>(
  TOKEN_DISK_LOCAL,
  "emailTwoFactorTokenRecord",
  {
    deserializer: (emailTwoFactorTokenRecord) => emailTwoFactorTokenRecord,
  },
);

export const API_KEY_CLIENT_ID_DISK = new UserKeyDefinition<string>(TOKEN_DISK, "apiKeyClientId", {
  deserializer: (apiKeyClientId) => apiKeyClientId,
  clearOn: [], // Manually handled
});

export const API_KEY_CLIENT_ID_MEMORY = new UserKeyDefinition<string>(
  TOKEN_MEMORY,
  "apiKeyClientId",
  {
    deserializer: (apiKeyClientId) => apiKeyClientId,
    clearOn: [], // Manually handled
  },
);

export const API_KEY_CLIENT_SECRET_DISK = new UserKeyDefinition<string>(
  TOKEN_DISK,
  "apiKeyClientSecret",
  {
    deserializer: (apiKeyClientSecret) => apiKeyClientSecret,
    clearOn: [], // Manually handled
  },
);

export const API_KEY_CLIENT_SECRET_MEMORY = new UserKeyDefinition<string>(
  TOKEN_MEMORY,
  "apiKeyClientSecret",
  {
    deserializer: (apiKeyClientSecret) => apiKeyClientSecret,
    clearOn: [], // Manually handled
  },
);

export const SECURITY_STAMP_MEMORY = new UserKeyDefinition<string>(TOKEN_MEMORY, "securityStamp", {
  deserializer: (securityStamp) => securityStamp,
  clearOn: ["logout"],
});
