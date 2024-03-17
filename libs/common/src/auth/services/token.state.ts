import { KeyDefinition, TOKEN_DISK, TOKEN_DISK_LOCAL, TOKEN_MEMORY } from "../../platform/state";

export const ACCESS_TOKEN_DISK = new KeyDefinition<string>(TOKEN_DISK, "accessToken", {
  deserializer: (accessToken) => accessToken,
});

export const ACCESS_TOKEN_MEMORY = new KeyDefinition<string>(TOKEN_MEMORY, "accessToken", {
  deserializer: (accessToken) => accessToken,
});

export const ACCESS_TOKEN_MIGRATED_TO_SECURE_STORAGE = new KeyDefinition<boolean>(
  TOKEN_DISK,
  "accessTokenMigratedToSecureStorage",
  {
    deserializer: (accessTokenMigratedToSecureStorage) => accessTokenMigratedToSecureStorage,
  },
);

export const REFRESH_TOKEN_DISK = new KeyDefinition<string>(TOKEN_DISK, "refreshToken", {
  deserializer: (refreshToken) => refreshToken,
});

export const REFRESH_TOKEN_MEMORY = new KeyDefinition<string>(TOKEN_MEMORY, "refreshToken", {
  deserializer: (refreshToken) => refreshToken,
});

export const REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE = new KeyDefinition<boolean>(
  TOKEN_DISK,
  "refreshTokenMigratedToSecureStorage",
  {
    deserializer: (refreshTokenMigratedToSecureStorage) => refreshTokenMigratedToSecureStorage,
  },
);

export const EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL = KeyDefinition.record<string, string>(
  TOKEN_DISK_LOCAL,
  "emailTwoFactorTokenRecord",
  {
    deserializer: (emailTwoFactorTokenRecord) => emailTwoFactorTokenRecord,
  },
);

export const API_KEY_CLIENT_ID_DISK = new KeyDefinition<string>(TOKEN_DISK, "apiKeyClientId", {
  deserializer: (apiKeyClientId) => apiKeyClientId,
});

export const API_KEY_CLIENT_ID_MEMORY = new KeyDefinition<string>(TOKEN_MEMORY, "apiKeyClientId", {
  deserializer: (apiKeyClientId) => apiKeyClientId,
});

export const API_KEY_CLIENT_SECRET_DISK = new KeyDefinition<string>(
  TOKEN_DISK,
  "apiKeyClientSecret",
  {
    deserializer: (apiKeyClientSecret) => apiKeyClientSecret,
  },
);

export const API_KEY_CLIENT_SECRET_MEMORY = new KeyDefinition<string>(
  TOKEN_MEMORY,
  "apiKeyClientSecret",
  {
    deserializer: (apiKeyClientSecret) => apiKeyClientSecret,
  },
);
