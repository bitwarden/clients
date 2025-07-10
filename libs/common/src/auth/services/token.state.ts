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

export const ACCESS_TOKEN_DISK = new UserKeyDefinition<string>(TOKEN_DISK, "accessToken", {
  deserializer: (accessToken) => accessToken,
  clearOn: [], // Manually handled
});

export const ACCESS_TOKEN_MEMORY = new UserKeyDefinition<string>(TOKEN_MEMORY, "accessToken", {
  deserializer: (accessToken) => accessToken,
  clearOn: [], // Manually handled
});

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
