import {
  KeyDefinition,
  TOKEN_DISK,
  TOKEN_DISK_LOCAL,
  TOKEN_MEMORY,
  UserKeyDefinition,
} from "../../platform/state";

// Note: all tokens / API key information must be cleared on logout.
// Memory keys clear on `logout` via the state event runner. Disk keys are managed by
// `TokenStorageSyncService.clearTokensFromDisk(userId)`, which also removes the OS
// secure storage entries the state framework cannot reach.

export const ACCESS_TOKEN_DISK = new UserKeyDefinition<string>(TOKEN_DISK, "accessToken", {
  deserializer: (accessToken) => accessToken,
  clearOn: [], // Cleared by TokenStorageSyncService.clearTokensFromDisk on logout.
});

export const ACCESS_TOKEN_MEMORY = new UserKeyDefinition<string>(TOKEN_MEMORY, "accessToken", {
  deserializer: (accessToken) => accessToken,
  clearOn: ["logout"],
  // Keeps the observable cold (no shareReplay/ReplaySubject caching). Each subscription
  // reads fresh from memory rather than replaying a cached value from a hot observable.
  cleanupDelayMs: 0,
});

export const REFRESH_TOKEN_DISK = new UserKeyDefinition<string>(TOKEN_DISK, "refreshToken", {
  deserializer: (refreshToken) => refreshToken,
  clearOn: [], // Cleared by TokenStorageSyncService.clearTokensFromDisk on logout.
});

export const REFRESH_TOKEN_MEMORY = new UserKeyDefinition<string>(TOKEN_MEMORY, "refreshToken", {
  deserializer: (refreshToken) => refreshToken,
  clearOn: ["logout"],
  // Same rationale as ACCESS_TOKEN_MEMORY — keeps the observable cold so every
  // subscription reads fresh from memory.
  cleanupDelayMs: 0,
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
  clearOn: [], // Cleared by TokenStorageSyncService.clearTokensFromDisk on logout.
});

export const API_KEY_CLIENT_ID_MEMORY = new UserKeyDefinition<string>(
  TOKEN_MEMORY,
  "apiKeyClientId",
  {
    deserializer: (apiKeyClientId) => apiKeyClientId,
    clearOn: ["logout"],
    // Same rationale as ACCESS_TOKEN_MEMORY — keeps the observable cold so every
    // subscription reads fresh from memory.
    cleanupDelayMs: 0,
  },
);

export const API_KEY_CLIENT_SECRET_DISK = new UserKeyDefinition<string>(
  TOKEN_DISK,
  "apiKeyClientSecret",
  {
    deserializer: (apiKeyClientSecret) => apiKeyClientSecret,
    clearOn: [], // Cleared by TokenStorageSyncService.clearTokensFromDisk on logout.
  },
);

export const API_KEY_CLIENT_SECRET_MEMORY = new UserKeyDefinition<string>(
  TOKEN_MEMORY,
  "apiKeyClientSecret",
  {
    deserializer: (apiKeyClientSecret) => apiKeyClientSecret,
    clearOn: ["logout"],
    // Same rationale as ACCESS_TOKEN_MEMORY — keeps the observable cold so every
    // subscription reads fresh from memory.
    cleanupDelayMs: 0,
  },
);

export const SECURITY_STAMP_MEMORY = new UserKeyDefinition<string>(TOKEN_MEMORY, "securityStamp", {
  deserializer: (securityStamp) => securityStamp,
  clearOn: ["logout"],
});

// Coordination flag set by TokenStorageSyncService.init() and awaited by waitForHydration().
export const TOKEN_STORAGE_HYDRATED = new KeyDefinition<boolean>(
  TOKEN_MEMORY,
  "tokenStorageHydrated",
  {
    deserializer: (hydrated) => hydrated,
  },
);
